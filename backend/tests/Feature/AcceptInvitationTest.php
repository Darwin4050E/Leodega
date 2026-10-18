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
use PHPUnit\Framework\Attributes\DataProvider;
use RuntimeException;
use Tests\TestCase;

/**
 * huc-14 U1b INV-17: POST /api/invitations/{invitation}/accept. An accept makes
 * the invitee a member (role member, no spending limit), closes the invitation
 * as `accepted` and tells the admins in app only. Every refusal is a static
 * message and writes nothing.
 */
class AcceptInvitationTest extends TestCase
{
    use RefreshDatabase;

    private const ORGANIZATION_KEYS = ['id', 'name', 'ruc', 'email', 'logo', 'status', 'role'];

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

    /**
     * @param  array<string, mixed>  $overrides
     */
    private function invitation(string $state = 'pending', ?User $invitee = null, ?Organization $organization = null, array $overrides = []): OrganizationInvitation
    {
        $invitee ??= $this->invitee;
        $factory = OrganizationInvitation::factory();

        return ($state === 'pending' ? $factory : $factory->{$state}())->create($overrides + [
            'organization_id' => ($organization ?? $this->organization)->id,
            'invited_user_id' => $invitee->id,
            'invited_by_user_id' => $this->admin->id,
            'email' => strtolower($invitee->email),
        ]);
    }

    private function accept(OrganizationInvitation|int $invitation, ?User $caller = null): TestResponse
    {
        $id = $invitation instanceof OrganizationInvitation ? $invitation->id : $invitation;

        return $this->actingAs($caller ?? $this->invitee, 'sanctum')->postJson("/api/invitations/{$id}/accept");
    }

    /**
     * @return list<array<string, mixed>>
     */
    private function memberships(?User $user = null): array
    {
        return DB::table('organization_user')
            ->when($user, fn ($query) => $query->where('user_id', $user->id))
            ->orderBy('id')
            ->get()
            ->map(fn ($row) => (array) $row)
            ->all();
    }

    private function assertRefused(TestResponse $response, string $message): void
    {
        $response->assertStatus(409)->assertExactJson(['message' => $message]);
    }

    private function assertNothingChanged(OrganizationInvitation $invitation, InvitationStatus $stored = InvitationStatus::Pending): void
    {
        $this->assertSame([], $this->memberships($this->invitee));
        $this->assertSame($stored, $invitation->fresh()->status);
        $this->assertNull($invitation->fresh()->responded_at);
        $this->assertSame(0, Notifications::query()->count());
    }

    // INV-S160
    public function test_an_accept_adds_exactly_one_member_row_with_no_limit_and_the_join_time()
    {
        $now = Carbon::parse('2026-10-17 12:00:00');
        Carbon::setTestNow($now);
        $invitation = $this->invitation();

        $this->accept($invitation)->assertOk();

        $rows = $this->memberships($this->invitee);
        $this->assertCount(1, $rows);
        $this->assertSame($this->organization->id, $rows[0]['organization_id']);
        $this->assertSame(OrganizationRole::MEMBER->value, $rows[0]['role']);
        $this->assertNull($rows[0]['monthly_limit']);
        $this->assertSame($now->toDateTimeString(), $rows[0]['joined_at']);
    }

    // INV-S161
    public function test_the_invitation_becomes_accepted_with_the_response_time_and_the_same_expiry()
    {
        $now = Carbon::parse('2026-10-17 12:00:00');
        Carbon::setTestNow($now);
        $invitation = $this->invitation();
        $expiresAt = $invitation->fresh()->expires_at;

        $this->accept($invitation)->assertOk();

        $fresh = $invitation->fresh();
        $this->assertSame(InvitationStatus::Accepted, $fresh->status);
        $this->assertTrue($fresh->responded_at->equalTo($now));
        $this->assertTrue($fresh->expires_at->equalTo($expiresAt));
    }

    // INV-S162
    public function test_the_response_is_a_bare_organization_with_the_member_role()
    {
        $response = $this->accept($this->invitation())->assertOk();

        $this->assertSame(self::ORGANIZATION_KEYS, array_keys($response->json()));
        $response->assertExactJson([
            'id' => $this->organization->id,
            'name' => 'Andina',
            'ruc' => $this->organization->ruc,
            'email' => $this->organization->email,
            'logo' => null,
            'status' => 'active',
            'role' => 'member',
        ]);
    }

    // INV-S163
    public function test_the_organization_list_of_the_invitee_shows_the_new_membership()
    {
        $this->accept($this->invitation())->assertOk();

        $listed = $this->actingAs($this->invitee, 'sanctum')->getJson('/api/organizations')->assertOk()->json();

        $this->assertCount(1, $listed);
        $this->assertSame(['id', 'name', 'ruc', 'email', 'logo', 'status', 'role'], array_keys($listed[0]));
        $this->assertSame($this->organization->id, $listed[0]['id']);
        $this->assertSame('member', $listed[0]['role']);
    }

    // INV-S164
    public function test_an_admin_sees_the_new_member_without_a_limit_and_the_wallet_is_untouched()
    {
        $this->accept($this->invitation())->assertOk();

        $members = $this->actingAs($this->admin, 'sanctum')
            ->getJson("/api/organizations/{$this->organization->id}/spending-limits")
            ->assertOk()->json();

        $row = collect($members)->firstWhere('user_id', $this->invitee->id);
        $this->assertNotNull($row);
        $this->assertSame('member', $row['role']);
        $this->assertNull($row['monthly_limit']);
        $this->assertSame('0.00', $this->organization->fresh()->wallet_balance);
        $this->assertSame(0, DB::table('organization_wallet_movements')->count());
    }

    // INV-S165
    public function test_one_second_before_the_expiry_succeeds_and_the_expiry_instant_is_refused()
    {
        $now = Carbon::parse('2026-10-17 12:00:00');
        Carbon::setTestNow($now);
        $lastSecond = $this->invitation('pending', $this->invitee, null, ['expires_at' => $now->copy()->addSecond()]);
        $otherInvitee = $this->user();
        $atExpiry = $this->invitation('pending', $otherInvitee, null, ['expires_at' => $now->copy()]);

        $this->accept($lastSecond)->assertOk();
        $this->assertRefused($this->accept($atExpiry, $otherInvitee), self::IC12_UNAVAILABLE);

        $this->assertSame([], $this->memberships($otherInvitee));
    }

    // INV-S166
    public function test_another_pending_invitation_of_the_invitee_is_untouched()
    {
        $second = Organization::factory()->withMember($this->admin, OrganizationRole::ADMIN)->create();
        $other = $this->invitation('pending', $this->invitee, $second);
        $other->refresh();

        $this->accept($this->invitation())->assertOk();

        $this->assertSame($other->toArray(), $other->fresh()->toArray());
        $this->assertSame(InvitationStatus::Pending, $other->fresh()->status);
    }

    // INV-S182
    public function test_an_accept_sends_no_email()
    {
        $this->accept($this->invitation())->assertOk();

        Mail::assertNothingSent();
        Mail::assertNothingQueued();
        Notification::assertNothingSent();
    }

    // INV-S167, INV-S168
    public static function nonActiveOrganizationStatuses(): array
    {
        return ['inactive' => ['inactive'], 'suspended' => ['suspended']];
    }

    #[DataProvider('nonActiveOrganizationStatuses')]
    public function test_an_organization_that_is_not_active_refuses_the_accept_and_writes_nothing(string $status)
    {
        $invitation = $this->invitation();
        $this->organization->update(['status' => $status]);

        $this->assertRefused($this->accept($invitation), self::IC12_UNAVAILABLE);

        $this->assertNothingChanged($invitation);
    }

    // INV-S169
    public function test_the_same_accept_succeeds_once_the_organization_is_active_again()
    {
        $invitation = $this->invitation();
        $this->organization->update(['status' => 'inactive']);
        $this->assertRefused($this->accept($invitation), self::IC12_UNAVAILABLE);

        $this->organization->update(['status' => 'active']);

        $this->accept($invitation)->assertOk();
        $this->assertSame(InvitationStatus::Accepted, $invitation->fresh()->status);
    }

    // INV-S170
    public static function ineligibleAccountStates(): array
    {
        return ['blocked' => ['blocked'], 'pending' => ['pending']];
    }

    #[DataProvider('ineligibleAccountStates')]
    public function test_an_account_that_is_not_active_cannot_accept(string $state)
    {
        $this->invitee->update(['state' => $state]);
        $invitation = $this->invitation();

        $this->assertRefused($this->accept($invitation), self::IC12_UNAVAILABLE);

        $this->assertNothingChanged($invitation);
    }

    // INV-S171
    public function test_an_existing_membership_refuses_the_accept_and_stays_a_single_row()
    {
        $this->organization->users()->attach($this->invitee->id, ['role' => OrganizationRole::MEMBER->value]);
        $invitation = $this->invitation();
        $before = $this->memberships($this->invitee);

        $this->assertRefused($this->accept($invitation), self::IC12_UNAVAILABLE);

        $this->assertSame($before, $this->memberships($this->invitee));
        $this->assertCount(1, $before);
        $this->assertSame(InvitationStatus::Pending, $invitation->fresh()->status);
        $this->assertSame(0, Notifications::query()->count());
    }

    // INV-S172: a concurrent accept inserts the membership between the check
    // and the attach, so the unique index fires
    public function test_a_unique_violation_on_the_membership_is_a_409_and_not_an_accept()
    {
        $invitation = $this->invitation();
        $racing = false;
        DB::connection()->beforeExecuting(function (string $sql) use (&$racing) {
            if ($racing || ! str_starts_with(strtolower($sql), 'insert into "organization_user"')) {
                return;
            }

            $racing = true;
            DB::table('organization_user')->insert([
                'organization_id' => $this->organization->id,
                'user_id' => $this->invitee->id,
                'role' => OrganizationRole::MEMBER->value,
            ]);
        });

        $this->assertRefused($this->accept($invitation), self::IC12_UNAVAILABLE);

        $this->assertTrue($racing, 'The accept must reach the membership insert.');
        $this->assertSame(InvitationStatus::Pending, $invitation->fresh()->status);
        $this->assertNull($invitation->fresh()->responded_at);
        $this->assertSame(0, Notifications::query()->count());
    }

    // INV-S173
    public function test_a_cancelled_invitation_is_409_and_unchanged()
    {
        $invitation = $this->invitation('cancelled');

        $this->assertRefused($this->accept($invitation), self::IC12_UNAVAILABLE);

        $this->assertNothingChanged($invitation, InvitationStatus::Cancelled);
    }

    // INV-S174: the stored value stays as it was (assumption A2)
    public function test_a_lapsed_pending_invitation_is_409_and_reads_as_expired_afterwards()
    {
        $invitation = $this->invitation('lapsed');

        $this->assertRefused($this->accept($invitation), self::IC12_UNAVAILABLE);

        $this->assertSame([], $this->memberships($this->invitee));
        $this->assertSame(InvitationStatus::Expired, $invitation->fresh()->effective_status);
        $this->assertSame(0, Notifications::query()->count());
    }

    // INV-S175
    public function test_a_stored_expired_invitation_is_409()
    {
        $invitation = $this->invitation('expired');

        $this->assertRefused($this->accept($invitation), self::IC12_UNAVAILABLE);

        $this->assertNothingChanged($invitation, InvitationStatus::Expired);
    }

    // INV-S176
    public function test_accepting_twice_is_409_already_responded_with_one_membership_and_one_notification_set()
    {
        $invitation = $this->invitation();

        $this->accept($invitation)->assertOk();
        $this->assertRefused($this->accept($invitation), self::IC80_ALREADY_RESPONDED);

        $this->assertCount(1, $this->memberships($this->invitee));
        $this->assertSame(1, Notifications::query()->count());
    }

    // INV-S177
    public function test_a_rejected_invitation_cannot_be_accepted()
    {
        $invitation = $this->invitation('rejected');

        $this->assertRefused($this->accept($invitation), self::IC80_ALREADY_RESPONDED);

        $this->assertSame([], $this->memberships($this->invitee));
        $this->assertSame(InvitationStatus::Rejected, $invitation->fresh()->status);
        $this->assertSame(0, Notifications::query()->count());
    }

    // INV-S178: no resurrection, only a new invitation can re-join
    public function test_an_accepted_invitation_cannot_be_reused_after_the_membership_was_removed()
    {
        $invitation = $this->invitation();
        $this->accept($invitation)->assertOk();
        $this->organization->users()->detach($this->invitee->id);

        $this->assertRefused($this->accept($invitation), self::IC80_ALREADY_RESPONDED);

        $this->assertSame([], $this->memberships($this->invitee));
        $this->assertSame(InvitationStatus::Accepted, $invitation->fresh()->status);
    }

    // INV-S179: the status is judged before the organization
    public function test_the_invitation_status_wins_over_an_inactive_organization()
    {
        $accepted = $this->invitation('accepted');
        $this->organization->update(['status' => 'inactive']);
        $this->assertRefused($this->accept($accepted), self::IC80_ALREADY_RESPONDED);

        $otherInvitee = $this->user();
        $cancelled = $this->invitation('cancelled', $otherInvitee);
        $this->assertRefused($this->accept($cancelled, $otherInvitee), self::IC12_UNAVAILABLE);
    }

    // INV-S180: the second admin's insert fails after the first one went through
    public function test_a_notification_failure_undoes_the_membership_and_leaves_the_invitation_pending()
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

        $this->accept($invitation)->assertServerError();

        $this->assertSame(2, $inserts);
        $this->assertNothingChanged($invitation);
    }

    // INV-S181
    public function test_a_membership_insert_failure_that_is_not_a_unique_violation_rolls_everything_back()
    {
        $invitation = $this->invitation();
        DB::connection()->beforeExecuting(function (string $sql) {
            if (str_starts_with(strtolower($sql), 'insert into "organization_user"')) {
                throw new RuntimeException('membership store down');
            }
        });

        $this->accept($invitation)->assertServerError();

        $this->assertNothingChanged($invitation);
    }

    // INV-S181: a failure after the fan-out undoes the notifications too
    public function test_a_failure_after_the_fan_out_undoes_the_notifications_and_the_membership()
    {
        $invitation = $this->invitation();
        $notified = false;
        Notifications::created(function () use (&$notified) {
            $notified = true;
        });
        DB::connection()->beforeExecuting(function (string $sql) use (&$notified) {
            // The re-query of the organization through the user's relation
            // runs after the admins were told.
            if ($notified && str_contains($sql, 'pivot_user_id')) {
                throw new RuntimeException('reload failed');
            }
        });

        $this->accept($invitation)->assertServerError();

        $this->assertTrue($notified, 'The fan-out must have run before the failure.');
        $this->assertNothingChanged($invitation);
    }
}
