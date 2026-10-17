<?php

namespace App\Notifications;

use App\Models\OrganizationInvitation;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/**
 * hue-01 INV-12: tells the invitee about a new invitation. The invitee decides
 * inside the app, so the mail carries no token, invitation id or respond link:
 * only the link to the invitations page.
 *
 * Deliberately does NOT implement ShouldQueue: backend/Procfile defines only a
 * `web:` process, so a queued notification would never be consumed by a worker.
 */
class OrganizationInvitationNotification extends Notification
{
    use Queueable;

    public const INVITATIONS_PATH = '/mi-cuenta/invitaciones';

    public function __construct(private OrganizationInvitation $invitation) {}

    public function via($notifiable)
    {
        unset($notifiable);

        return ['mail'];
    }

    public function toMail($notifiable)
    {
        $this->invitation->loadMissing(['organization', 'inviter']);

        $organization = $this->invitation->organization->name;

        return (new MailMessage)
            ->subject("Te invitaron a unirte a {$organization}")
            ->greeting("Hola {$notifiable->name},")
            ->line("{$this->invitation->inviter->name} te invitó a unirte a {$organization} como miembro y operar en su nombre.")
            ->line('Esta invitación vence en '.OrganizationInvitation::EXPIRY_DAYS.' días.')
            ->action('Mis invitaciones', rtrim(config('app.frontend_url'), '/').self::INVITATIONS_PATH);
    }
}
