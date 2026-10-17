<?php

namespace App\Services;

use App\Enums\NotificationType;
use App\Models\OrganizationInvitation;
use App\Notifications\OrganizationInvitationNotification;

/**
 * hue-01 INV-11/INV-12: tells the invitee about a new invitation, in app
 * (inside the invite transaction) and by email (after it commits). Nobody else
 * is notified.
 */
class OrganizationInvitationNotifier
{
    public const NOTIFICATION_TITLE = 'Te invitaron a unirte a una organización';

    public function notifyInApp(OrganizationInvitation $invitation): void
    {
        $invitation->loadMissing(['organization', 'inviter']);

        NotificationService::send(
            $invitation->invited_by_user_id,
            $invitation->invited_user_id,
            NotificationType::ORGANIZATION_INVITATION,
            self::NOTIFICATION_TITLE,
            "{$invitation->inviter->name} te invitó a unirte a {$invitation->organization->name} como miembro.",
            [
                'invitation_id' => $invitation->id,
                'organization_id' => $invitation->organization_id,
            ]
        );
    }

    /**
     * Sent synchronously, so the caller must run it after the transaction
     * commits and treat a failure as non-fatal.
     */
    public function emailInvitee(OrganizationInvitation $invitation): void
    {
        $invitation->loadMissing('invitee');

        $invitation->invitee->notify(new OrganizationInvitationNotification($invitation));
    }
}
