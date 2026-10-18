<?php

namespace Tests\Feature;

use App\Enums\InvitationStatus;
use App\Enums\OrganizationRole;
use App\Models\Notifications;
use App\Models\Organization;
use App\Models\OrganizationInvitation;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Notification;
use Illuminate\Testing\TestResponse;
use RuntimeException;
use Tests\TestCase;

/**
 * huc-14 U1a INV-18: POST /api/invitations/{invitation}/reject. A reject keeps
 * the row as `rejected`, never blocks on organization or account state, and
 * tells the admins in app only. The accept half of INV-S191 runs with accept
 * in U1b.
 */
class RejectInvitationTest extends TestCase
{
    use RefreshDatabase;

    private const ITEM_KEYS = [
        'id', 'organization_id', 'organization_name', 'invited_by_name', 'role', 'status',
        'expires_at', 'created_at', 'responded_at', 'can_respond',
    ];

    private const IC12_UNAVAILABLE = 'Esta invitación ya no está disponible';

    private const IC80_ALREADY_RESPONDED = 'Ya respondiste esta invitación';

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
        $this->organization = Organization::factory()
            ->withMember($this->admin, OrganizationRole::ADMIN)
            ->create(['name' => 'Andina']);
    }

    protected function tearDown(): void
    {
        Carbon::setTestNow();

        parent::tearDown();
    }

    private function user(string $state = 'active'): User
    {
        return User::factory()->create(['role' => 'tenant', 'state' => $state]);
    }

    private function invitation(string $state = 'pending', ?User $invitee = null): OrganizationInvitation
    {
        $invitee ??= $this->invitee;
        $factory = OrganizationInvitation::factory();

        return ($state === 'pending' ? $factory : $factory->{$state}())->create([
            'organization_id' => $this->organization->id,
            'invited_user_id' => $invitee->id,
            'invited_by_user_id' => $this->admin->id,
            'email' => strtolower($invitee->email),
        ]);
    }

    private function reject(OrganizationInvitation|int $invitation, ?User $caller = null): TestResponse
    {
        $id = $invitation instanceof OrganizationInvitation ? $invitation->id : $invitation;

        return $this->actingAs($caller ?? $this->invitee, 'sanctum')->postJson("/api/invitations/{$id}/reject");
    }

    /**
     * @return list<array<string, mixed>>
     */
    private function memberships(): array
    {
        return DB::table('organization_user')->orderBy('id')->get()->map(fn ($row) => (array) $row)->all();
    }

    private function assertRefused(TestResponse $response, int $status, string $message): void
    {
        $response->assertStatus($status)->assertExactJson(['message' => $message]);
    }

    // INV-S184
    public function test_a_pending_invitation_is_rejected_and_returned_as_an_inbox_item()
    {
        $now = Carbon::parse('2026-10-17 12:00:00');
        Carbon::setTestNow($now);
        $invitation = $this->invitation();

        $response = $this->reject($invitation)->assertOk();

        $this->assertSame(self::ITEM_KEYS, array_keys($response->json()));
        $response->assertJson([
            'id' => $invitation->id,
            'organization_id' => $this->organization->id,
            'organization_name' => 'Andina',
            'invited_by_name' => $this->admin->name,
            'role' => 'member',
            'status' => 'rejected',
            'can_respond' => false,
            'responded_at' => $now->toISOString(),
        ]);
    }

    // INV-S185
    public function test_a_reject_touches_no_membership_organization_list_or_wallet()
    {
        Organization::factory()->withMember($this->invitee, OrganizationRole::MEMBER)->create();
        $invitation = $this->invitation();
        $membershipsBefore = $this->memberships();
        $listBefore = $this->actingAs($this->invitee, 'sanctum')->getJson('/api/organizations')->json();
        $this->assertCount(1, $listBefore);

        $this->reject($invitation)->assertOk();

        $this->assertSame($membershipsBefore, $this->memberships());
        $this->assertSame($listBefore, $this->actingAs($this->invitee, 'sanctum')->getJson('/api/organizations')->json());
        $this->assertSame('0.00', $this->organization->fresh()->wallet_balance);
        $this->assertSame(0, DB::table('organization_wallet_movements')->count());
    }

    // INV-S186
    public function test_the_row_is_retained_as_rejected()
    {
        $invitation = $this->invitation();

        $this->reject($invitation)->assertOk();

        $this->assertDatabaseCount('organization_invitations', 1);
        $fresh = $invitation->fresh();
        $this->assertSame(InvitationStatus::Rejected, $fresh->status);
        $this->assertNotNull($fresh->responded_at);
    }

    // INV-S187
    public function test_a_lapsed_pending_invitation_is_409_and_left_as_stored()
    {
        $invitation = $this->invitation('lapsed');
        $before = $invitation->fresh()->toArray();

        $this->assertRefused($this->reject($invitation), 409, self::IC12_UNAVAILABLE);

        $this->assertSame($before, $invitation->fresh()->toArray());
        $this->assertSame(InvitationStatus::Pending, $invitation->fresh()->status);
    }

    // INV-S188
    public function test_a_cancelled_invitation_is_409_with_the_unavailable_message()
    {
        $invitation = $this->invitation('cancelled');

        $this->assertRefused($this->reject($invitation), 409, self::IC12_UNAVAILABLE);
        $this->assertSame(InvitationStatus::Cancelled, $invitation->fresh()->status);
    }

    // INV-S189
    public function test_rejecting_twice_is_409_already_responded_the_second_time()
    {
        $invitation = $this->invitation();

        $this->reject($invitation)->assertOk();
        $this->assertRefused($this->reject($invitation), 409, self::IC80_ALREADY_RESPONDED);

        $this->assertSame(InvitationStatus::Rejected, $invitation->fresh()->status);
        $this->assertSame(1, Notifications::query()->count());
    }

    // INV-S190
    public function test_an_accepted_invitation_cannot_be_rejected_and_the_membership_stays()
    {
        $invitation = $this->invitation('accepted');
        $this->organization->users()->attach($this->invitee->id, ['role' => OrganizationRole::MEMBER->value]);

        $this->assertRefused($this->reject($invitation), 409, self::IC80_ALREADY_RESPONDED);

        $this->assertSame(InvitationStatus::Accepted, $invitation->fresh()->status);
        $this->assertTrue($this->organization->users()->whereKey($this->invitee->id)->exists());
        $this->assertSame(0, Notifications::query()->count());
    }

    // INV-S192
    public function test_an_inactive_organization_does_not_block_a_reject()
    {
        $invitation = $this->invitation();
        $this->organization->update(['status' => 'inactive']);

        $this->reject($invitation)->assertOk()->assertJsonPath('status', 'rejected');
    }

    // INV-S193
    public function test_an_account_that_is_not_active_can_still_reject()
    {
        $blocked = $this->user('blocked');
        $invitation = $this->invitation('pending', $blocked);

        $this->reject($invitation, $blocked)->assertOk()->assertJsonPath('status', 'rejected');
        $this->assertSame(InvitationStatus::Rejected, $invitation->fresh()->status);
    }

    // INV-S194, INV-S53
    public function test_an_admin_can_invite_the_same_user_again_after_a_reject()
    {
        $invitation = $this->invitation();
        $this->reject($invitation)->assertOk();

        $this->actingAs($this->admin, 'sanctum')
            ->postJson("/api/organizations/{$this->organization->id}/invitations", ['email' => $this->invitee->email])
            ->assertCreated();

        $this->assertSame(2, OrganizationInvitation::query()->count());
        $this->assertSame(InvitationStatus::Rejected, $invitation->fresh()->status);
        $this->assertSame(1, OrganizationInvitation::query()->pending()->count());
    }

    // INV-S195
    public function test_a_reject_sends_no_email()
    {
        $this->reject($this->invitation())->assertOk();

        Mail::assertNothingSent();
        Mail::assertNothingQueued();
        Notification::assertNothingSent();
    }

    // INV-S196: the second admin's insert fails after the first one went through
    public function test_a_notification_failure_leaves_the_invitation_pending_and_creates_nothing()
    {
        $secondAdmin = $this->user();
        $this->organization->users()->attach($secondAdmin->id, ['role' => OrganizationRole::ADMIN->value]);
        $invitation = $this->invitation();
        $inserts = 0;
        Notifications::creating(function () use (&$inserts) {
            if (++$inserts === 2) {
                throw new RuntimeException('notification store down');
            }
        });

        $this->reject($invitation)->assertServerError();

        $this->assertSame(2, $inserts);
        $this->assertSame(InvitationStatus::Pending, $invitation->fresh()->status);
        $this->assertNull($invitation->fresh()->responded_at);
        $this->assertSame(0, Notifications::query()->count());
    }
}
