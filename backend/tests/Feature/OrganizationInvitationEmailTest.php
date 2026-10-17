<?php

namespace Tests\Feature;

use App\Enums\OrganizationRole;
use App\Models\Notifications;
use App\Models\Organization;
use App\Models\OrganizationInvitation;
use App\Models\User;
use App\Notifications\OrganizationInvitationNotification;
use App\Services\OrganizationInvitationNotifier;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Notification;
use Illuminate\Testing\TestResponse;
use RuntimeException;
use Tests\TestCase;

/**
 * hue-01 U1b INV-12: after the invite transaction commits, the invitee gets a
 * plain notification email. A mail failure never undoes the invitation.
 */
class OrganizationInvitationEmailTest extends TestCase
{
    use RefreshDatabase;

    private Organization $organization;

    private User $admin;

    private User $invitee;

    protected function setUp(): void
    {
        parent::setUp();

        Notification::fake();
        config(['app.frontend_url' => 'https://app.leodega.test']);

        $this->admin = $this->user('Maria Lopez');
        $this->invitee = $this->user('Lucia Ramos');
        $this->organization = Organization::factory()
            ->withMember($this->admin, OrganizationRole::ADMIN)
            ->create(['name' => 'Andina']);
    }

    private function user(string $name, array $attributes = []): User
    {
        return User::factory()->create(['role' => 'tenant', 'state' => 'active', 'name' => $name] + $attributes);
    }

    private function invite(string $email): TestResponse
    {
        return $this->actingAs($this->admin, 'sanctum')
            ->postJson("/api/organizations/{$this->organization->id}/invitations", ['email' => $email]);
    }

    private function sentMail(User $to, int $times = 1): MailMessage
    {
        $mail = null;
        Notification::assertSentToTimes($to, OrganizationInvitationNotification::class, $times);
        Notification::assertSentTo($to, OrganizationInvitationNotification::class, function ($notification) use ($to, &$mail) {
            $mail = $notification->toMail($to);

            return true;
        });

        return $mail;
    }

    private function failingMail(): void
    {
        $this->app->bind(OrganizationInvitationNotifier::class, fn () => new class extends OrganizationInvitationNotifier
        {
            public function emailInvitee(OrganizationInvitation $invitation): void
            {
                throw new RuntimeException('smtp down');
            }
        });
    }

    private function failingInApp(): void
    {
        $this->app->bind(OrganizationInvitationNotifier::class, fn () => new class extends OrganizationInvitationNotifier
        {
            public function notifyInApp(OrganizationInvitation $invitation): void
            {
                throw new RuntimeException('notification store down');
            }
        });
    }

    // INV-S100
    public function test_the_invitee_gets_exactly_one_synchronous_email()
    {
        $this->invite($this->invitee->email)->assertCreated();

        $this->sentMail($this->invitee);
        Notification::assertCount(1);
        $this->assertNotInstanceOf(ShouldQueue::class, new OrganizationInvitationNotification(
            OrganizationInvitation::query()->firstOrFail()
        ));
    }

    // INV-S101
    public function test_the_email_carries_the_approved_copy_and_the_invitations_link()
    {
        $this->invite($this->invitee->email)->assertCreated();

        $mail = $this->sentMail($this->invitee);
        $this->assertSame('Te invitaron a unirte a Andina', $mail->subject);
        $this->assertSame('Hola Lucia Ramos,', $mail->greeting);
        $this->assertSame([
            'Maria Lopez te invitó a unirte a Andina como miembro y operar en su nombre.',
            'Esta invitación vence en 7 días.',
        ], $mail->introLines);
        $this->assertSame('Mis invitaciones', $mail->actionText);
        $this->assertSame('https://app.leodega.test/mi-cuenta/invitaciones', $mail->actionUrl);
    }

    public function test_a_trailing_slash_on_the_frontend_url_does_not_double_up()
    {
        config(['app.frontend_url' => 'https://app.leodega.test/']);

        $this->invite($this->invitee->email)->assertCreated();

        $this->assertSame(
            'https://app.leodega.test/mi-cuenta/invitaciones',
            $this->sentMail($this->invitee)->actionUrl
        );
    }

    public function test_the_frontend_url_has_a_default_so_the_link_is_never_relative()
    {
        // setUp overrides the config, so read the shipped file.
        $this->assertNotEmpty((require config_path('app.php'))['frontend_url'] ?? null);
    }

    // INV-S102
    public function test_the_email_has_no_invitation_id_token_or_respond_link()
    {
        $response = $this->invite($this->invitee->email)->assertCreated();

        $mail = $this->sentMail($this->invitee);
        $rendered = json_encode([$mail->subject, $mail->greeting, $mail->introLines, $mail->actionText, $mail->actionUrl]);
        $this->assertStringNotContainsString('token', $rendered);
        $this->assertStringNotContainsString('signature', $rendered);
        $this->assertStringNotContainsString('accept', $rendered);
        $this->assertStringNotContainsString('reject', $rendered);
        $this->assertStringNotContainsString('/'.$response->json('id'), $rendered);
        $this->assertSame([], $mail->outroLines);
    }

    // INV-S103
    public function test_a_rolled_back_invite_sends_no_email()
    {
        $this->failingInApp();

        $this->invite($this->invitee->email)->assertServerError();

        Notification::assertNothingSent();
    }

    // INV-S104
    public function test_a_mail_failure_does_not_undo_the_invitation()
    {
        Log::spy();
        $this->failingMail();

        $this->invite($this->invitee->email)->assertCreated();

        $this->assertSame(1, OrganizationInvitation::query()->count());
        $this->assertSame(1, Notifications::query()->where('receiver_id', $this->invitee->id)->count());
        Log::shouldHaveReceived('error')->once();
    }

    // INV-S105
    public function test_refusals_and_validation_failures_send_no_email()
    {
        $this->invite('')->assertUnprocessable();
        $this->invite('nobody@example.com')->assertUnprocessable();
        $this->invite($this->admin->email)->assertUnprocessable();
        $this->invite($this->invitee->email)->assertCreated();
        Notification::assertCount(1);

        $this->invite($this->invitee->email)->assertUnprocessable();

        Notification::assertCount(1);
    }

    // INV-S106
    public function test_a_re_invite_sends_a_new_email()
    {
        $this->invite($this->invitee->email)->assertCreated();
        $this->travel(OrganizationInvitation::EXPIRY_DAYS + 1)->days();

        $this->invite($this->invitee->email)->assertCreated();

        $this->sentMail($this->invitee, 2);
    }

    // INV-S107
    public function test_the_email_goes_to_the_address_as_stored_on_the_account()
    {
        $mixed = $this->user('Ana Mixta', ['email' => 'Ana.Mixta@Example.COM']);

        $response = $this->invite('ana.mixta@example.com')->assertCreated();

        $this->assertSame('ana.mixta@example.com', $response->json('email'));
        Notification::assertSentTo(
            $mixed,
            OrganizationInvitationNotification::class,
            fn ($notification, $channels, $notifiable) => $notifiable->routeNotificationFor('mail') === 'Ana.Mixta@Example.COM'
        );
    }
}
