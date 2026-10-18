<?php

namespace Tests\Feature;

use App\Enums\InvitationStatus;
use App\Enums\OrganizationRole;
use App\Models\Notifications;
use App\Models\Organization;
use App\Models\OrganizationInvitation;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Testing\TestResponse;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

/**
 * huc-14 U1a INV-15 (list and reject halves; the accept target joins the data
 * providers in U1b): the personal invitee routes sit behind auth + the tenant
 * role, are scoped to the caller, and treat a foreign, a nonexistent and a
 * malformed id identically.
 */
class InvitationInboxAuthorizationTest extends TestCase
{
    use RefreshDatabase;

    private const FORBIDDEN = 'No autorizado';

    private const NOT_FOUND = 'Invitación no encontrada';

    private Organization $organization;

    private User $admin;

    private User $invitee;

    protected function setUp(): void
    {
        parent::setUp();

        $this->admin = $this->user();
        $this->invitee = $this->user();
        $this->organization = Organization::factory()->withMember($this->admin, OrganizationRole::ADMIN)->create();
    }

    private function user(string $role = 'tenant'): User
    {
        return User::factory()->create(['role' => $role, 'state' => 'active']);
    }

    private function invitationFor(User $invitee, ?Organization $organization = null): OrganizationInvitation
    {
        return OrganizationInvitation::factory()->create([
            'organization_id' => ($organization ?? $this->organization)->id,
            'invited_user_id' => $invitee->id,
            'invited_by_user_id' => $this->admin->id,
            'email' => strtolower($invitee->email),
        ]);
    }

    /**
     * @param  array<string, string>  $headers
     */
    private function hit(string $target, ?User $caller, int|string $invitationId = 1, array $headers = []): TestResponse
    {
        $request = $caller ? $this->actingAs($caller, 'sanctum') : $this;
        $request = $request->withHeaders($headers);

        return match ($target) {
            'list' => $request->getJson('/api/invitations'),
            'reject' => $request->postJson("/api/invitations/{$invitationId}/reject"),
        };
    }

    public static function allTargets(): array
    {
        return ['list' => ['list'], 'reject' => ['reject']];
    }

    public static function idTargets(): array
    {
        return ['reject' => ['reject']];
    }

    private function assertNothingWritten(OrganizationInvitation $invitation): void
    {
        $this->assertSame(InvitationStatus::Pending, $invitation->fresh()->status);
        $this->assertNull($invitation->fresh()->responded_at);
        $this->assertSame(0, Notifications::query()->count());
        $this->assertDatabaseCount('organization_user', 1);
    }

    // INV-S129
    #[DataProvider('allTargets')]
    public function test_a_request_without_a_token_is_401(string $target)
    {
        $this->hit($target, null)
            ->assertStatus(401)
            ->assertExactJson(['message' => 'Unauthenticated.']);
    }

    // INV-S130, INV-S131
    public static function wrongRoles(): array
    {
        return [
            'list as landlord' => ['list', 'landlord'],
            'list as platform admin' => ['list', 'admin'],
            'reject as landlord' => ['reject', 'landlord'],
            'reject as platform admin' => ['reject', 'admin'],
        ];
    }

    #[DataProvider('wrongRoles')]
    public function test_a_landlord_and_a_platform_admin_are_403_and_nothing_is_written(string $target, string $role)
    {
        $invitation = $this->invitationFor($this->invitee);

        $this->hit($target, $this->user($role), $invitation->id)
            ->assertStatus(403)
            ->assertExactJson(['message' => self::FORBIDDEN]);

        $this->assertNothingWritten($invitation);
    }

    // INV-S132
    #[DataProvider('idTargets')]
    public function test_a_landlord_with_a_nonexistent_id_gets_403_not_404(string $target)
    {
        $this->hit($target, $this->user('landlord'), 987654)
            ->assertStatus(403)
            ->assertExactJson(['message' => self::FORBIDDEN]);
    }

    // INV-S133, INV-S134
    #[DataProvider('idTargets')]
    public function test_a_foreign_and_a_nonexistent_invitation_get_the_identical_404(string $target)
    {
        $foreign = $this->invitationFor($this->user());

        $foreignResponse = $this->hit($target, $this->invitee, $foreign->id);
        $missingResponse = $this->hit($target, $this->invitee, 987654);

        foreach ([$foreignResponse, $missingResponse] as $response) {
            $response->assertStatus(404)->assertExactJson(['message' => self::NOT_FOUND]);
        }
        $this->assertSame($foreignResponse->getContent(), $missingResponse->getContent());
        $this->assertNothingWritten($foreign);
    }

    // INV-S135
    public static function malformedIds(): array
    {
        return [
            'reject 0' => ['reject', '0'],
            'reject abc' => ['reject', 'abc'],
            'reject 19 digits' => ['reject', '1234567890123456789'],
        ];
    }

    #[DataProvider('malformedIds')]
    public function test_malformed_ids_are_404(string $target, string $id)
    {
        $own = $this->invitationFor($this->invitee);

        $this->hit($target, $this->invitee, $id)->assertNotFound();

        $this->assertNothingWritten($own);
    }

    // INV-S136: being an admin of the invitation's organization grants nothing
    #[DataProvider('idTargets')]
    public function test_an_admin_of_the_organization_who_is_not_the_invitee_gets_404(string $target)
    {
        $invitation = $this->invitationFor($this->invitee);

        $this->hit($target, $this->admin, $invitation->id)
            ->assertStatus(404)
            ->assertExactJson(['message' => self::NOT_FOUND]);

        $this->assertNothingWritten($invitation);
    }

    // INV-S137: the active-organization header plays no role
    public static function headerTargets(): array
    {
        return ['list' => ['list', 200], 'reject' => ['reject', 404]];
    }

    #[DataProvider('headerTargets')]
    public function test_the_organization_header_is_ignored(string $target, int $expectedStatus)
    {
        $this->invitationFor($this->invitee);
        $otherOrganization = Organization::factory()->create();

        $responses = collect([
            ['X-Organization-Id' => (string) $otherOrganization->id],
            ['X-Organization-Id' => 'abc'],
            [],
        ])->map(fn (array $headers) => $this->hit($target, $this->invitee, 987654, $headers));

        foreach ($responses as $response) {
            $this->assertSame($expectedStatus, $response->getStatusCode());
        }
        $this->assertCount(1, $responses->map(fn (TestResponse $response) => $response->getContent())->unique());
    }

    // INV-S138: belonging to other organizations is no obstacle
    #[DataProvider('allTargets')]
    public function test_an_invitee_who_belongs_to_other_organizations_is_allowed(string $target)
    {
        Organization::factory()->withMember($this->invitee, OrganizationRole::MEMBER)->create();
        $invitation = $this->invitationFor($this->invitee);

        $this->hit($target, $this->invitee, $invitation->id)->assertOk();
    }

    // INV-S139: the role middleware answers before the lookup
    #[DataProvider('allTargets')]
    public function test_a_role_changed_to_landlord_is_403_and_the_row_is_unchanged(string $target)
    {
        $invitation = $this->invitationFor($this->invitee);
        $this->invitee->update(['role' => 'landlord']);

        $this->hit($target, $this->invitee, $invitation->id)
            ->assertStatus(403)
            ->assertExactJson(['message' => self::FORBIDDEN]);

        $this->assertNothingWritten($invitation);
    }

    // INV-S140
    public function test_every_401_403_and_404_body_has_only_a_message()
    {
        $invitation = $this->invitationFor($this->invitee);

        $responses = [
            $this->hit('list', null),
            $this->hit('reject', null, $invitation->id),
            $this->hit('list', $this->user('landlord')),
            $this->hit('reject', $this->user('admin'), $invitation->id),
            $this->hit('reject', $this->invitee, 987654),
            $this->hit('reject', $this->admin, $invitation->id),
        ];

        foreach ($responses as $response) {
            $this->assertSame(['message'], array_keys($response->json()));
        }
    }
}
