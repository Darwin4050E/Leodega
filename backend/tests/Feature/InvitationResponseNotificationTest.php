<?php

namespace Tests\Feature;

use App\Enums\InvitationStatus;
use App\Enums\NotificationType;
use App\Enums\OrganizationRole;
use App\Models\Notifications;
use App\Models\Organization;
use App\Models\OrganizationInvitation;
use App\Models\User;
use App\Services\OrganizationInvitationNotifier;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Notification;
use Illuminate\Testing\TestResponse;
use Tests\TestCase;

/**
 * huc-14 U1a INV-20: the admins of an organization are told, in app, when an
 * invitee responds. Proven here at notifier level for both outcomes (accept
 * has no HTTP path until U1b) and over HTTP for reject.
 */
class InvitationResponseNotificationTest extends TestCase
{
    use RefreshDatabase;

    private const KEYS = ['invitation_id', 'organization_id'];

    private Organization $organization;

    private User $adminA;

    private User $adminB;

    private User $invitee;

    protected function setUp(): void
    {
        parent::setUp();

        Notification::fake();
        Mail::fake();

        $this->adminA = $this->tenant();
        $this->adminB = $this->tenant();
        $this->invitee = $this->tenant();
        $this->organization = Organization::factory()
            ->withMember($this->adminA, OrganizationRole::ADMIN)
            ->withMember($this->adminB, OrganizationRole::ADMIN)
            ->create(['name' => 'Andina']);
    }

    private function tenant(): User
    {
        return User::factory()->create(['role' => 'tenant', 'state' => 'active']);
    }

    private function invitation(): OrganizationInvitation
    {
        return OrganizationInvitation::factory()->create([
            'organization_id' => $this->organization->id,
            'invited_user_id' => $this->invitee->id,
            'invited_by_user_id' => $this->adminA->id,
            'email' => strtolower($this->invitee->email),
        ]);
    }

    private function notifyAdmins(OrganizationInvitation $invitation, InvitationStatus $outcome): void
    {
        app(OrganizationInvitationNotifier::class)->notifyAdminsOfResponse($invitation, $this->invitee, $outcome);
    }

    private function notificationsFor(User $user)
    {
        return Notifications::query()->where('receiver_id', $user->id)->get();
    }

    // INV-S215
    public function test_the_enum_has_the_two_response_values_and_the_existing_fifteen_cases()
    {
        $this->assertSame('organization_invitation_accepted', NotificationType::ORGANIZATION_INVITATION_ACCEPTED->value);
        $this->assertSame('organization_invitation_rejected', NotificationType::ORGANIZATION_INVITATION_REJECTED->value);
        $this->assertSame(
            [
                'message', 'reservation_booked_and_paid', 'reservation_confirmed', 'reservation_canceled',
                'reservation_expired', 'store_created', 'store_reported', 'store_approved', 'store_rejected',
                'store_resubmitted', 'store_permit_replaced', 'store_edited', 'account_blocked',
                'account_reactivated', 'organization_invitation',
            ],
            array_slice(array_map(fn ($case) => $case->value, NotificationType::cases()), 0, 15)
        );
        $this->assertCount(17, NotificationType::cases());
    }

    // INV-S204 (notifier level), INV-S213
    public function test_an_accepted_response_notifies_every_admin_and_nobody_else()
    {
        $invitation = $this->invitation();

        $this->notifyAdmins($invitation, InvitationStatus::Accepted);

        $this->assertSame(2, Notifications::query()->count());
        foreach ([$this->adminA, $this->adminB] as $admin) {
            $notification = $this->notificationsFor($admin)->sole();
            $this->assertSame($this->invitee->id, $notification->sender_id);
            $this->assertSame('organization_invitation_accepted', $notification->type);
            $this->assertSame('Invitación aceptada', $notification->title);
            $this->assertSame("{$this->invitee->name} se unió a la organización Andina.", $notification->body);
            $this->assertSame(
                ['invitation_id' => $invitation->id, 'organization_id' => $this->organization->id],
                $notification->data
            );
            $this->assertSame(self::KEYS, array_keys($notification->data));
        }
        $this->assertSame(0, $this->notificationsFor($this->invitee)->count());
    }

    // INV-S205 (notifier level)
    public function test_a_rejected_response_uses_the_rejected_type_title_and_invitation_email()
    {
        $invitation = $this->invitation();

        $this->notifyAdmins($invitation, InvitationStatus::Rejected);

        $notification = $this->notificationsFor($this->adminA)->sole();
        $this->assertSame('organization_invitation_rejected', $notification->type);
        $this->assertSame('Invitación rechazada', $notification->title);
        $this->assertSame(
            "{$invitation->email} rechazó la invitación a unirse a Andina.",
            $notification->body
        );
        $this->assertSame(2, Notifications::query()->count());
    }

    // INV-S206, INV-S209
    public function test_members_and_admins_of_other_organizations_receive_nothing()
    {
        $member = $this->tenant();
        $this->organization->users()->attach($member->id, ['role' => OrganizationRole::MEMBER->value]);
        $foreignAdmin = $this->tenant();
        Organization::factory()->withMember($foreignAdmin, OrganizationRole::ADMIN)->create();
        $invitation = $this->invitation();

        $this->notifyAdmins($invitation, InvitationStatus::Accepted);

        $this->assertSame(0, $this->notificationsFor($member)->count());
        $this->assertSame(0, $this->notificationsFor($foreignAdmin)->count());
        $this->assertSame(
            [$this->adminA->id, $this->adminB->id],
            Notifications::query()->orderBy('receiver_id')->pluck('receiver_id')->all()
        );
    }

    // INV-S207
    public function test_an_invitee_who_is_also_an_admin_is_not_notified_about_themselves()
    {
        $this->organization->users()->attach($this->invitee->id, ['role' => OrganizationRole::ADMIN->value]);
        $invitation = $this->invitation();

        $this->notifyAdmins($invitation, InvitationStatus::Accepted);

        $this->assertSame(0, $this->notificationsFor($this->invitee)->count());
        $this->assertSame(1, $this->notificationsFor($this->adminA)->count());
        $this->assertSame(1, $this->notificationsFor($this->adminB)->count());
    }

    // INV-S208
    public function test_an_organization_without_admins_creates_zero_notifications()
    {
        $this->organization->users()->detach([$this->adminA->id, $this->adminB->id]);
        $member = $this->tenant();
        $this->organization->users()->attach($member->id, ['role' => OrganizationRole::MEMBER->value]);
        $invitation = $this->invitation();

        $this->notifyAdmins($invitation, InvitationStatus::Rejected);

        $this->assertSame(0, Notifications::query()->count());
    }

    private function reject(OrganizationInvitation|int $invitation): TestResponse
    {
        $id = $invitation instanceof OrganizationInvitation ? $invitation->id : $invitation;

        return $this->actingAs($this->invitee, 'sanctum')->postJson("/api/invitations/{$id}/reject");
    }

    // INV-S205
    public function test_a_reject_notifies_each_admin_with_the_rejected_type_title_and_email_body()
    {
        $invitation = $this->invitation();

        $this->reject($invitation)->assertOk();

        $this->assertSame(2, Notifications::query()->count());
        foreach ([$this->adminA, $this->adminB] as $admin) {
            $notification = $this->notificationsFor($admin)->sole();
            $this->assertSame($this->invitee->id, $notification->sender_id);
            $this->assertSame('organization_invitation_rejected', $notification->type);
            $this->assertSame('Invitación rechazada', $notification->title);
            $this->assertSame("{$invitation->email} rechazó la invitación a unirse a Andina.", $notification->body);
            $this->assertSame(
                ['invitation_id' => $invitation->id, 'organization_id' => $this->organization->id],
                $notification->data
            );
        }
    }

    // INV-S207
    public function test_a_reject_by_an_invitee_who_is_also_an_admin_notifies_only_the_other_admins()
    {
        $this->organization->users()->attach($this->invitee->id, ['role' => OrganizationRole::ADMIN->value]);

        $this->reject($this->invitation())->assertOk();

        $this->assertSame(0, $this->notificationsFor($this->invitee)->count());
        $this->assertSame(2, Notifications::query()->count());
    }

    // INV-S206, INV-S209
    public function test_members_and_admins_of_other_organizations_get_nothing_over_http()
    {
        $member = $this->tenant();
        $this->organization->users()->attach($member->id, ['role' => OrganizationRole::MEMBER->value]);
        $foreignAdmin = $this->tenant();
        Organization::factory()->withMember($foreignAdmin, OrganizationRole::ADMIN)->create();

        $this->reject($this->invitation())->assertOk();

        $this->assertSame(0, $this->notificationsFor($member)->count());
        $this->assertSame(0, $this->notificationsFor($foreignAdmin)->count());
        $this->assertSame(2, Notifications::query()->count());
    }

    // INV-S210
    public function test_refused_attempts_create_no_notification()
    {
        $foreign = OrganizationInvitation::factory()->create([
            'organization_id' => $this->organization->id,
            'invited_by_user_id' => $this->adminA->id,
        ]);
        $cancelled = OrganizationInvitation::factory()->cancelled()->create([
            'organization_id' => $this->organization->id,
            'invited_user_id' => $this->invitee->id,
            'invited_by_user_id' => $this->adminA->id,
        ]);

        $this->reject(987654)->assertNotFound();
        $this->reject($foreign)->assertNotFound();
        $this->reject($cancelled)->assertStatus(409);

        $this->assertSame(0, Notifications::query()->count());
    }

    // INV-S211
    public function test_a_response_sends_no_email()
    {
        $this->reject($this->invitation())->assertOk();

        Mail::assertNothingSent();
        Mail::assertNothingQueued();
        Notification::assertNothingSent();
    }

    // INV-S212
    public function test_an_admin_sees_the_notification_in_the_list_and_the_unread_count()
    {
        $this->reject($this->invitation())->assertOk();

        $listed = $this->actingAs($this->adminA, 'sanctum')->getJson('/api/notifications')->assertOk()->json();
        $this->assertCount(1, $listed);
        $this->assertSame('organization_invitation_rejected', $listed[0]['type']);
        $this->actingAs($this->adminA, 'sanctum')
            ->getJson('/api/notifications-unread-count')
            ->assertOk()
            ->assertJson(['count' => 1]);
    }

    // INV-S213
    public function test_the_invitee_receives_no_notification_for_their_own_response()
    {
        $this->reject($this->invitation())->assertOk();

        $this->assertSame(0, $this->notificationsFor($this->invitee)->count());
    }

    // INV-S214
    public function test_the_earlier_invitation_notification_is_kept_with_its_read_state()
    {
        $this->actingAs($this->adminA, 'sanctum')
            ->postJson("/api/organizations/{$this->organization->id}/invitations", ['email' => $this->invitee->email])
            ->assertCreated();
        $earlier = $this->notificationsFor($this->invitee)->sole();
        $earlier->update(['is_read' => true]);
        $invitationId = $earlier->data['invitation_id'];

        $this->reject($invitationId)->assertOk();

        $kept = $this->notificationsFor($this->invitee)->sole();
        $this->assertSame($earlier->id, $kept->id);
        $this->assertSame('organization_invitation', $kept->type);
        $this->assertTrue($kept->is_read);
    }

    // INV-S208
    public function test_a_reject_succeeds_with_zero_notifications_when_no_admin_is_left()
    {
        $invitation = $this->invitation();
        $this->organization->users()->detach([$this->adminA->id, $this->adminB->id]);

        $this->reject($invitation)->assertOk()->assertJsonPath('status', 'rejected');

        $this->assertSame(0, Notifications::query()->count());
    }
}
