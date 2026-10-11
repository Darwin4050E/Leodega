<?php

namespace Tests\Feature;

use App\Enums\InvitationStatus;
use App\Enums\OrganizationRole;
use App\Models\Notifications;
use App\Models\Organization;
use App\Models\OrganizationInvitation;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Route;
use Illuminate\Testing\TestResponse;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

/**
 * hue-01 U1b: DELETE /organizations/{organization}/invitations/{invitation}
 * (INV-13 and the DELETE rows of INV-2). A revoke keeps the row as `cancelled`
 * and sends nothing. The PostgreSQL-only lock checks are at the end; the race
 * itself is in OrganizationInvitationRevokeConcurrencyTest.
 */
class RevokeInvitationTest extends TestCase
{
    use RefreshDatabase;

    private const KEYS = ['id', 'email', 'status', 'expires_at', 'created_at', 'responded_at', 'invited_by_name', 'can_be_revoked'];

    private const NOT_MEMBER = 'No perteneces a la organización seleccionada';

    private const FORBIDDEN_ROLE = 'No autorizado';

    private const IC12_UNAVAILABLE = 'Esta invitación ya no está disponible';

    private const IC13_NOT_FOUND = 'Invitación no encontrada';

    private Organization $organization;

    private User $admin;

    private User $invitee;

    protected function setUp(): void
    {
        parent::setUp();

        Notification::fake();
        Mail::fake();

        $this->admin = $this->tenant();
        $this->invitee = $this->tenant();
        $this->organization = Organization::factory()->withMember($this->admin, OrganizationRole::ADMIN)->create();
    }

    private function tenant(string $role = 'tenant'): User
    {
        return User::factory()->create(['role' => $role, 'state' => 'active']);
    }

    private function invitation(string $state = 'pending', ?Organization $organization = null, ?User $inviter = null, ?User $invitee = null): OrganizationInvitation
    {
        $invitee ??= $this->tenant();

        $factory = OrganizationInvitation::factory();

        return ($state === 'pending' ? $factory : $factory->{$state}())->create([
            'organization_id' => ($organization ?? $this->organization)->id,
            'invited_user_id' => $invitee->id,
            'invited_by_user_id' => ($inviter ?? $this->admin)->id,
            'email' => strtolower($invitee->email),
        ]);
    }

    private function revoke(?User $caller, Organization|int|string|null $organization, int|string $invitation): TestResponse
    {
        $organization ??= $this->organization;
        $organizationId = $organization instanceof Organization ? $organization->id : $organization;
        $request = $caller ? $this->actingAs($caller, 'sanctum') : $this;

        return $request->deleteJson("/api/organizations/{$organizationId}/invitations/{$invitation}");
    }

    private function secondAdmin(): User
    {
        $other = $this->tenant();
        $this->organization->users()->attach($other->id, ['role' => OrganizationRole::ADMIN->value]);

        return $other;
    }

    private function assertUntouched(OrganizationInvitation $invitation, InvitationStatus $status = InvitationStatus::Pending): void
    {
        $this->assertSame($status, $invitation->fresh()->status);
    }

    // INV-S108
    public function test_any_admin_can_revoke_a_pending_invitation_of_another_admin()
    {
        $other = $this->secondAdmin();
        $invitation = $this->invitation();

        $response = $this->revoke($other, null, $invitation->id)->assertOk();

        $this->assertSame(self::KEYS, array_keys($response->json()));
        $response->assertJson([
            'id' => $invitation->id,
            'status' => 'cancelled',
            'can_be_revoked' => false,
            'invited_by_name' => $this->admin->name,
        ]);
        $this->assertDatabaseHas('organization_invitations', ['id' => $invitation->id, 'status' => 'cancelled']);
        $this->assertDatabaseCount('organization_invitations', 1);
    }

    // INV-S109
    public function test_the_inviter_can_revoke_their_own_invitation()
    {
        $invitation = $this->invitation();

        $this->revoke($this->admin, null, $invitation->id)->assertOk()->assertJsonPath('status', 'cancelled');
    }

    // INV-S9
    public function test_a_request_without_a_token_is_401()
    {
        $invitation = $this->invitation();

        $this->revoke(null, null, $invitation->id)
            ->assertStatus(401)
            ->assertExactJson(['message' => 'Unauthenticated.']);
        $this->assertUntouched($invitation);
    }

    // INV-S10, INV-S11
    public static function wrongRoles(): array
    {
        return ['landlord' => ['landlord'], 'platform admin' => ['admin']];
    }

    #[DataProvider('wrongRoles')]
    public function test_a_landlord_and_a_platform_admin_are_403_with_the_role_message(string $role)
    {
        $invitation = $this->invitation();

        $this->revoke($this->tenant($role), null, $invitation->id)
            ->assertStatus(403)
            ->assertExactJson(['message' => self::FORBIDDEN_ROLE]);
        $this->assertUntouched($invitation);
    }

    // INV-S110, INV-S12, INV-S13, INV-S21
    public function test_a_member_and_a_non_member_are_refused_and_the_row_is_unchanged()
    {
        $member = $this->tenant();
        $this->organization->users()->attach($member->id, ['role' => OrganizationRole::MEMBER->value]);
        $outsider = $this->tenant();
        $invitation = $this->invitation();

        $this->revoke($member, null, $invitation->id)
            ->assertStatus(403)
            ->assertExactJson(['message' => self::FORBIDDEN_ROLE]);
        $this->revoke($outsider, null, $invitation->id)
            ->assertStatus(403)
            ->assertExactJson(['message' => self::NOT_MEMBER]);
        $this->revoke($outsider, 987654, $invitation->id)
            ->assertStatus(403)
            ->assertExactJson(['message' => self::NOT_MEMBER]);
        $this->assertUntouched($invitation);
    }

    // INV-S111
    public function test_a_member_revoking_a_nonexistent_invitation_gets_403_not_404()
    {
        $member = $this->tenant();
        $this->organization->users()->attach($member->id, ['role' => OrganizationRole::MEMBER->value]);

        $this->revoke($member, null, 987654)
            ->assertStatus(403)
            ->assertExactJson(['message' => self::FORBIDDEN_ROLE]);
    }

    // INV-S18
    public function test_a_demoted_admin_is_refused_at_once()
    {
        $other = $this->secondAdmin();
        $invitation = $this->invitation();
        $this->organization->users()->updateExistingPivot($other->id, ['role' => OrganizationRole::MEMBER->value]);

        $this->revoke($other, null, $invitation->id)
            ->assertStatus(403)
            ->assertExactJson(['message' => self::FORBIDDEN_ROLE]);
        $this->assertUntouched($invitation);
    }

    // INV-S20, INV-S113, INV-S121
    public static function malformedPaths(): array
    {
        return [
            'organization abc' => ['abc', null],
            'organization 0' => ['0', null],
            'organization 19 digits' => ['1234567890123456789', null],
            'invitation abc' => [null, 'abc'],
            'invitation 0' => [null, '0'],
            'invitation 19 digits' => [null, '1234567890123456789'],
        ];
    }

    #[DataProvider('malformedPaths')]
    public function test_malformed_path_ids_are_404(?string $organization, ?string $invitation)
    {
        $existing = $this->invitation();

        $this->revoke($this->admin, $organization, $invitation ?? $existing->id)->assertNotFound();
        $this->assertUntouched($existing);
    }

    // INV-S112
    public function test_an_invitation_of_another_organization_and_a_nonexistent_one_get_the_identical_404()
    {
        $otherOrganization = Organization::factory()->create();
        $foreign = $this->invitation('pending', $otherOrganization);

        $foreignResponse = $this->revoke($this->admin, null, $foreign->id);
        $missingResponse = $this->revoke($this->admin, null, 987654);

        foreach ([$foreignResponse, $missingResponse] as $response) {
            $response->assertStatus(404)->assertExactJson(['message' => self::IC13_NOT_FOUND]);
        }
        $this->assertSame($foreignResponse->getContent(), $missingResponse->getContent());
        $this->assertUntouched($foreign);
    }

    // INV-S114, INV-S115
    public static function terminalStates(): array
    {
        return ['accepted' => ['accepted'], 'rejected' => ['rejected'], 'cancelled' => ['cancelled'], 'expired' => ['expired']];
    }

    #[DataProvider('terminalStates')]
    public function test_an_invitation_that_is_no_longer_pending_is_409_and_nothing_changes(string $state)
    {
        $invitation = $this->invitation($state);
        $before = $invitation->fresh()->toArray();

        $this->revoke($this->admin, null, $invitation->id)
            ->assertStatus(409)
            ->assertExactJson(['message' => self::IC12_UNAVAILABLE]);

        $this->assertSame($before, $invitation->fresh()->toArray());
        $this->assertDatabaseCount('organization_user', 1);
    }

    // INV-S116
    public function test_revoking_twice_is_409_the_second_time()
    {
        $invitation = $this->invitation();

        $this->revoke($this->admin, null, $invitation->id)->assertOk();
        $this->revoke($this->admin, null, $invitation->id)
            ->assertStatus(409)
            ->assertExactJson(['message' => self::IC12_UNAVAILABLE]);
    }

    // INV-S117
    public function test_a_lapsed_pending_invitation_is_409_and_is_not_persisted_as_anything()
    {
        $invitation = $this->invitation('lapsed');
        $before = $invitation->fresh()->toArray();

        $this->revoke($this->admin, null, $invitation->id)
            ->assertStatus(409)
            ->assertExactJson(['message' => self::IC12_UNAVAILABLE]);

        $this->assertSame($before, $invitation->fresh()->toArray());
        $this->assertUntouched($invitation);
    }

    // INV-S118
    public function test_a_revoked_user_can_be_invited_again()
    {
        $invitee = $this->tenant();
        $invitation = $this->invitation('pending', null, null, $invitee);
        $this->revoke($this->admin, null, $invitation->id)->assertOk();

        $this->actingAs($this->admin, 'sanctum')
            ->postJson("/api/organizations/{$this->organization->id}/invitations", ['email' => $invitee->email])
            ->assertCreated();

        $this->assertSame(2, OrganizationInvitation::query()->count());
    }

    // INV-S98, INV-S106, INV-S119
    public function test_a_revoke_creates_no_membership_notification_or_email()
    {
        $invitation = $this->invitation();

        $this->revoke($this->admin, null, $invitation->id)->assertOk();

        $this->assertDatabaseCount('organization_user', 1);
        $this->assertSame(0, Notifications::query()->count());
        Notification::assertNothingSent();
        Mail::assertNothingSent();
    }

    // INV-S47
    public function test_revoking_is_allowed_while_the_organization_is_inactive()
    {
        $invitation = $this->invitation();
        $this->organization->update(['status' => 'inactive']);

        $this->revoke($this->admin, null, $invitation->id)->assertOk()->assertJsonPath('status', 'cancelled');
    }

    // INV-S122
    public function test_every_refusal_body_has_only_a_message()
    {
        $member = $this->tenant();
        $this->organization->users()->attach($member->id, ['role' => OrganizationRole::MEMBER->value]);
        $accepted = $this->invitation('accepted');

        foreach ([
            $this->revoke($member, null, $accepted->id),
            $this->revoke($this->tenant(), null, $accepted->id),
            $this->revoke($this->admin, null, 987654),
            $this->revoke($this->admin, null, $accepted->id),
        ] as $response) {
            $this->assertSame(['message'], array_keys($response->json()));
        }
    }

    // INV-S70 (DELETE half)
    public function test_revoking_is_not_limited()
    {
        $invitations = collect(range(1, 15))->map(fn () => $this->invitation());

        foreach ($invitations as $invitation) {
            $this->revoke($this->admin, null, $invitation->id)->assertOk();
        }
    }

    // INV-S124
    public function test_the_route_carries_auth_and_role_but_no_org_context()
    {
        $route = Route::getRoutes()->match(
            app('request')->create("/api/organizations/{$this->organization->id}/invitations/1", 'DELETE')
        );

        $middleware = $route->gatherMiddleware();
        $this->assertContains('auth.api:sanctum', $middleware);
        $this->assertContains('role:tenant', $middleware);
        $this->assertNotContains('org.context', $middleware);
        $this->assertNotContains('throttle:org-invitations', $middleware);
    }

    // INV-S120 (lock half): PostgreSQL only, SQLite ignores FOR UPDATE
    public function test_the_invitation_is_selected_for_update()
    {
        if (DB::connection()->getDriverName() !== 'pgsql') {
            $this->markTestSkipped('Requires PostgreSQL: SQLite ignores FOR UPDATE.');
        }

        $invitation = $this->invitation();
        DB::enableQueryLog();

        $this->revoke($this->admin, null, $invitation->id)->assertOk();

        $locking = collect(DB::getQueryLog())->first(
            fn ($entry) => str_contains($entry['query'], 'organization_invitations')
                && str_contains(strtolower($entry['query']), 'for update')
        );
        $this->assertNotNull($locking, 'The invitation select must carry FOR UPDATE.');
    }
}
