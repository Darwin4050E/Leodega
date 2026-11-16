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
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Testing\TestResponse;
use RuntimeException;
use Tests\TestCase;

/**
 * hue-01 U1b INV-11: a successful invite writes exactly one in-app
 * notification for the invitee, inside the invite transaction. The mail is
 * covered by OrganizationInvitationEmailTest.
 */
class OrganizationInvitationNotificationTest extends TestCase
{
    use RefreshDatabase;

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

    private function user(): User
    {
        return User::factory()->create(['role' => 'tenant', 'state' => 'active']);
    }

    private function invite(string $email, ?User $caller = null): TestResponse
    {
        return $this->actingAs($caller ?? $this->admin, 'sanctum')
            ->postJson("/api/organizations/{$this->organization->id}/invitations", ['email' => $email]);
    }

    private function notificationsFor(User $user)
    {
        return Notifications::query()->where('receiver_id', $user->id)->get();
    }

    private function throwingNotifier(): void
    {
        $this->app->bind(OrganizationInvitationNotifier::class, fn () => new class extends OrganizationInvitationNotifier
        {
            public function notifyInApp(OrganizationInvitation $invitation): void
            {
                throw new RuntimeException('notification store down');
            }
        });
    }

    // INV-S93
    public function test_an_invite_creates_exactly_one_notification_for_the_invitee()
    {
        $response = $this->invite($this->invitee->email)->assertCreated();

        $this->assertSame(1, Notifications::query()->count());
        $notification = $this->notificationsFor($this->invitee)->sole();
        $this->assertSame($this->admin->id, $notification->sender_id);
        $this->assertSame(NotificationType::ORGANIZATION_INVITATION->value, $notification->type);
        $this->assertSame('organization_invitation', $notification->type);
        $this->assertSame('Te invitaron a unirte a una organización', $notification->title);
        $this->assertSame("{$this->admin->name} te invitó a unirte a Andina como miembro.", $notification->body);
        $this->assertSame(
            ['invitation_id' => $response->json('id'), 'organization_id' => $this->organization->id],
            $notification->data
        );
    }

    // INV-S93: the data payload carries exactly two keys, no url
    public function test_the_notification_data_has_exactly_the_invitation_and_organization_ids()
    {
        $this->invite($this->invitee->email)->assertCreated();

        $this->assertSame(
            ['invitation_id', 'organization_id'],
            array_keys($this->notificationsFor($this->invitee)->sole()->data)
        );
    }

    // INV-S61, INV-S94
    public function test_a_notification_failure_rolls_the_whole_invite_back()
    {
        $lapsed = OrganizationInvitation::factory()->lapsed()->create([
            'organization_id' => $this->organization->id,
            'invited_user_id' => $this->invitee->id,
            'email' => strtolower($this->invitee->email),
        ]);
        $this->throwingNotifier();

        $this->invite($this->invitee->email)->assertServerError();

        $this->assertSame(InvitationStatus::Pending, $lapsed->fresh()->status);
        $this->assertSame(1, OrganizationInvitation::query()->count());
        $this->assertSame(0, Notifications::query()->count());
    }

    // INV-S95
    public function test_refusals_and_validation_failures_create_no_notification()
    {
        $this->invite('')->assertUnprocessable();
        $this->invite('nobody@example.com')->assertUnprocessable();
        $this->invite($this->admin->email)->assertUnprocessable();

        $this->invite($this->invitee->email)->assertCreated();
        $this->invite($this->invitee->email)->assertUnprocessable();

        $this->assertSame(1, Notifications::query()->count());
    }

    // INV-S95: the throttled attempt writes nothing
    public function test_a_throttled_attempt_creates_no_notification()
    {
        RateLimiter::clear('org-invitations:'.$this->admin->id);
        for ($i = 0; $i < 10; $i++) {
            $this->invite('nobody'.$i.'@example.com')->assertUnprocessable();
        }

        $this->invite($this->invitee->email)->assertStatus(429);

        $this->assertSame(0, Notifications::query()->count());
    }

    // INV-S96
    public function test_neither_the_inviter_nor_other_admins_are_notified()
    {
        $otherAdmin = $this->user();
        $this->organization->users()->attach($otherAdmin->id, ['role' => OrganizationRole::ADMIN->value]);

        $this->invite($this->invitee->email)->assertCreated();

        $this->assertCount(0, $this->notificationsFor($this->admin));
        $this->assertCount(0, $this->notificationsFor($otherAdmin));
        $this->assertCount(1, $this->notificationsFor($this->invitee));
    }

    // INV-S97
    public function test_a_re_invite_after_the_first_lapsed_adds_a_second_notification()
    {
        $this->invite($this->invitee->email)->assertCreated();
        $this->travel(OrganizationInvitation::EXPIRY_DAYS + 1)->days();

        $this->invite($this->invitee->email)->assertCreated();

        $this->assertCount(2, $this->notificationsFor($this->invitee));
    }

    // INV-S99, INV-S127
    public function test_the_invitee_sees_the_notification_through_the_existing_notification_endpoints()
    {
        Notifications::create([
            'sender_id' => $this->admin->id,
            'receiver_id' => $this->invitee->id,
            'type' => NotificationType::MESSAGE->value,
            'title' => 'Older',
            'body' => null,
            'data' => [],
        ]);
        $this->invite($this->invitee->email)->assertCreated();

        $list = $this->actingAs($this->invitee, 'sanctum')->getJson('/api/notifications')->assertOk();
        $this->assertCount(2, $list->json());
        $this->assertContains('organization_invitation', array_column($list->json(), 'type'));
        $this->assertContains('message', array_column($list->json(), 'type'));

        $this->actingAs($this->invitee, 'sanctum')->getJson('/api/notifications-unread-count')
            ->assertOk()
            ->assertExactJson(['count' => 2]);
    }
}
