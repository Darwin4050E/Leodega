<?php

namespace Tests\Feature;

use App\Enums\InvitationStatus;
use App\Enums\OrganizationRole;
use App\Models\Organization;
use App\Models\OrganizationInvitation;
use App\Models\User;
use Carbon\CarbonInterface;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Notification;
use Illuminate\Testing\TestResponse;
use Tests\TestCase;

/**
 * hue-01 U1a: the success path of POST /organizations/{organization}/invitations
 * (INV-1, INV-6, INV-7). The race against a concurrent invite is simulated with
 * a `creating` listener; the real two-connection race is in
 * OrganizationInvitationConcurrencyTest (PostgreSQL only).
 */
class InviteMemberCreationTest extends TestCase
{
    use RefreshDatabase;

    private const KEYS = ['id', 'email', 'status', 'expires_at', 'created_at', 'responded_at', 'invited_by_name', 'can_be_revoked'];

    private const IC4_PENDING = 'Ya hay una invitación pendiente para este usuario en tu organización.';

    private Organization $organization;

    private User $admin;

    private User $invitee;

    protected function setUp(): void
    {
        parent::setUp();

        Notification::fake();
        Mail::fake();

        $this->admin = $this->user();
        $this->invitee = $this->user();
        $this->organization = Organization::factory()->withMember($this->admin, OrganizationRole::ADMIN)->create();
    }

    private function user(string $role = 'tenant'): User
    {
        return User::factory()->create(['role' => $role, 'state' => 'active']);
    }

    private function invite(string $email, ?User $caller = null, ?Organization $organization = null, array $extra = []): TestResponse
    {
        $organization ??= $this->organization;

        return $this->actingAs($caller ?? $this->admin, 'sanctum')
            ->postJson("/api/organizations/{$organization->id}/invitations", ['email' => $email] + $extra);
    }

    private function freeze(): CarbonInterface
    {
        $this->travelTo(now()->startOfSecond());

        return now();
    }

    private function secondAdmin(): User
    {
        $other = $this->user();
        $this->organization->users()->attach($other->id, ['role' => OrganizationRole::ADMIN->value]);

        return $other;
    }

    private function row(User $invitee, string $status, ?CarbonInterface $expiresAt = null, ?Organization $organization = null): OrganizationInvitation
    {
        return OrganizationInvitation::factory()->create([
            'organization_id' => ($organization ?? $this->organization)->id,
            'invited_user_id' => $invitee->id,
            'email' => strtolower($invitee->email),
            'status' => $status,
            'expires_at' => $expiresAt ?? now()->addDays(OrganizationInvitation::EXPIRY_DAYS),
        ]);
    }

    private function pendingCount(): int
    {
        return OrganizationInvitation::query()
            ->where('organization_id', $this->organization->id)
            ->where('invited_user_id', $this->invitee->id)
            ->where('status', InvitationStatus::Pending->value)
            ->count();
    }

    // INV-S14
    public function test_an_admin_who_is_not_the_creator_can_invite()
    {
        $other = $this->secondAdmin();

        $this->invite($this->invitee->email, $other)->assertCreated();
    }

    // INV-S18
    public function test_a_demoted_admin_is_refused_at_once()
    {
        $other = $this->secondAdmin();
        $this->invite($this->invitee->email, $other)->assertCreated();

        $this->organization->users()->updateExistingPivot($other->id, ['role' => OrganizationRole::MEMBER->value]);

        $this->invite($this->user()->email, $other)->assertForbidden()->assertExactJson(['message' => 'No autorizado']);
    }

    // INV-S49, INV-S56, INV-S88
    public function test_the_201_body_has_exactly_the_invitation_keys_and_no_invitee_data()
    {
        $response = $this->invite($this->invitee->email)->assertCreated();

        $this->assertSame(self::KEYS, array_keys($response->json()));
        $response->assertJson([
            'email' => strtolower($this->invitee->email),
            'status' => 'pending',
            'responded_at' => null,
            'invited_by_name' => $this->admin->name,
            'can_be_revoked' => true,
        ]);
        $body = $response->getContent();
        $this->assertStringNotContainsString($this->invitee->name, $body);
        $this->assertStringNotContainsString('user_id', $body);
        $this->assertStringNotContainsString('role', $body);
    }

    // INV-S8, INV-S50
    public function test_the_invitation_expires_seven_days_after_creation()
    {
        $now = $this->freeze();

        $response = $this->invite($this->invitee->email)->assertCreated();

        $this->assertTrue($now->copy()->addDays(7)->equalTo($response->json('expires_at')));
        $this->assertTrue($now->equalTo($response->json('created_at')));
        $this->assertTrue(OrganizationInvitation::first()->expires_at->equalTo($now->copy()->addDays(7)));
    }

    // INV-S51
    public function test_the_row_stores_the_organization_the_invitee_and_the_caller()
    {
        $other = $this->secondAdmin();

        $this->invite($this->invitee->email, $other)->assertCreated();

        $this->assertDatabaseHas('organization_invitations', [
            'organization_id' => $this->organization->id,
            'invited_user_id' => $this->invitee->id,
            'invited_by_user_id' => $other->id,
            'status' => 'pending',
        ]);
        $this->assertDatabaseCount('organization_invitations', 1);
    }

    // INV-S52
    public function test_an_invitation_creates_no_membership()
    {
        $this->invite($this->invitee->email)->assertCreated();

        $this->assertDatabaseMissing('organization_user', ['user_id' => $this->invitee->id]);

        $members = $this->actingAs($this->admin, 'sanctum')
            ->getJson("/api/organizations/{$this->organization->id}/spending-limits")
            ->assertOk()->json();
        $this->assertSame([$this->admin->id], array_column($members, 'user_id'));

        $listed = $this->actingAs($this->invitee, 'sanctum')->getJson('/api/organizations')->assertOk()->json();
        $this->assertNotContains($this->organization->id, array_column($listed, 'id'));
    }

    // INV-S27
    public function test_the_email_is_trimmed_matched_case_insensitively_and_stored_lowercase()
    {
        $maria = User::factory()->create(['role' => 'tenant', 'state' => 'active', 'email' => 'maria@example.com']);

        $response = $this->invite('  Maria@Example.COM ')->assertCreated();

        $this->assertSame('maria@example.com', $response->json('email'));
        $this->assertDatabaseHas('organization_invitations', ['invited_user_id' => $maria->id, 'email' => 'maria@example.com']);
    }

    // INV-S28
    public function test_extra_body_keys_are_ignored()
    {
        $this->invite($this->invitee->email, null, null, [
            'role' => 'admin', 'monthly_limit' => '5', 'user_id' => $this->admin->id,
        ])->assertCreated();

        $row = OrganizationInvitation::first();
        $this->assertSame($this->invitee->id, $row->invited_user_id);
        $this->assertDatabaseMissing('organization_user', ['user_id' => $this->invitee->id]);
    }

    // INV-S40
    public function test_a_member_of_another_organization_can_be_invited()
    {
        Organization::factory()->withMember($this->invitee, OrganizationRole::MEMBER)->create();

        $this->invite($this->invitee->email)->assertCreated();
    }

    // INV-S48
    public function test_the_same_request_succeeds_once_the_organization_is_active_again()
    {
        $this->organization->update(['status' => 'inactive']);
        $this->invite($this->invitee->email)->assertUnprocessable();

        $this->organization->update(['status' => 'active']);

        $this->invite($this->invitee->email)->assertCreated();
    }

    // INV-S53, INV-S54, INV-S55
    public function test_closed_invitations_do_not_block_a_new_one_and_stay_unchanged()
    {
        $old = [
            $this->row($this->invitee, 'rejected'),
            $this->row($this->invitee, 'cancelled'),
            $this->row($this->invitee, 'expired', now()->subDay()),
            $this->row($this->invitee, 'accepted'),
        ];

        $this->invite($this->invitee->email)->assertCreated();

        $this->assertDatabaseCount('organization_invitations', 5);
        $this->assertSame(
            ['rejected', 'cancelled', 'expired', 'accepted'],
            array_map(fn ($row) => $row->fresh()->status->value, $old)
        );
        $this->assertSame(1, $this->pendingCount());
    }

    // INV-S57
    public function test_each_admin_is_recorded_as_the_inviter_of_their_own_invitation()
    {
        $other = $this->secondAdmin();
        $second = $this->user();

        $first = $this->invite($this->invitee->email)->assertCreated();
        $third = $this->invite($second->email, $other)->assertCreated();

        $this->assertSame($this->admin->name, $first->json('invited_by_name'));
        $this->assertSame($other->name, $third->json('invited_by_name'));
    }

    // INV-S59
    public function test_a_lapsed_pending_invitation_is_expired_and_replaced()
    {
        $this->freeze();
        $old = $this->row($this->invitee, 'pending', now()->subDay());

        $new = $this->invite($this->invitee->email)->assertCreated();

        $old = $old->fresh();
        $this->assertSame(InvitationStatus::Expired, $old->status);
        $this->assertNull($old->responded_at);
        $this->assertNotSame($old->id, $new->json('id'));
        $this->assertSame('pending', $new->json('status'));
        $this->assertSame(1, $this->pendingCount());
    }

    // INV-S60
    public function test_expiry_exactly_now_counts_as_lapsed_and_one_second_later_does_not()
    {
        $now = $this->freeze();
        $this->row($this->invitee, 'pending', $now->copy());

        $this->invite($this->invitee->email)->assertCreated();

        $other = $this->user();
        $this->row($other, 'pending', $now->copy()->addSecond());

        $this->invite($other->email)->assertUnprocessable()->assertJsonPath('errors.email.0', self::IC4_PENDING);
    }

    // INV-S62
    public function test_a_unique_violation_raised_by_a_race_is_a_422_not_a_500()
    {
        $this->simulateCompetingInvite();

        $this->invite($this->invitee->email)
            ->assertUnprocessable()
            ->assertExactJson(['message' => self::IC4_PENDING, 'errors' => ['email' => [self::IC4_PENDING]]]);
    }

    // INV-S63
    public function test_a_lapsed_invitation_of_another_organization_is_left_untouched()
    {
        $this->freeze();
        $other = Organization::factory()->create();
        $foreign = $this->row($this->invitee, 'pending', now()->subDay(), $other);

        $this->invite($this->invitee->email)->assertCreated();

        $this->assertSame(InvitationStatus::Pending, $foreign->fresh()->status);
    }

    // INV-S90
    public function test_a_first_invitation_and_a_re_invitation_have_identical_key_sets()
    {
        $first = $this->invite($this->invitee->email)->assertCreated();
        $this->travel(8)->days();
        $again = $this->invite($this->invitee->email)->assertCreated();

        $this->assertSame(array_keys($first->json()), array_keys($again->json()));
    }

    /**
     * Inserts a competing pending row for the same pair right before the real
     * insert, as a concurrent request committing first would.
     */
    private function simulateCompetingInvite(): void
    {
        $fired = false;

        Event::listen('eloquent.creating: '.OrganizationInvitation::class, function () use (&$fired) {
            if ($fired) {
                return;
            }
            $fired = true;

            DB::table('organization_invitations')->insert([
                'organization_id' => $this->organization->id,
                'invited_user_id' => $this->invitee->id,
                'invited_by_user_id' => $this->admin->id,
                'email' => strtolower($this->invitee->email),
                'status' => 'pending',
                'expires_at' => now()->addDays(7),
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        });
    }
}
