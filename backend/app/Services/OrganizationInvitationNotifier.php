<?php

namespace App\Services;

use App\Enums\InvitationStatus;
use App\Enums\NotificationType;
use App\Enums\OrganizationRole;
use App\Models\OrganizationInvitation;
use App\Models\User;
use App\Notifications\OrganizationInvitationNotification;
use Illuminate\Support\Facades\DB;

/**
 * hue-01 INV-11/INV-12: tells the invitee about a new invitation, in app
 * (inside the invite transaction) and by email (after it commits).
 * huc-14 INV-20: tells the admins of the organization, in app only, when the
 * invitee accepts or rejects.
 */
class OrganizationInvitationNotifier
{
    public const NOTIFICATION_TITLE = 'Te invitaron a unirte a una organización';

    public const ACCEPTED_TITLE = 'Invitación aceptada';

    public const REJECTED_TITLE = 'Invitación rechazada';

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

    /**
     * One notification per admin of the organization (pivot role `admin`),
     * sent by the invitee and never to them. Members and admins of other
     * organizations get nothing. The accepted body names the invitee's
     * account, the rejected one uses the address the admins already know.
     * Runs inside the response transaction, so a failed insert undoes the
     * response.
     */
    public function notifyAdminsOfResponse(OrganizationInvitation $invitation, User $invitee, InvitationStatus $outcome): void
    {
        $invitation->loadMissing('organization');

        $organization = $invitation->organization;
        $accepted = $outcome === InvitationStatus::Accepted;

        $type = $accepted ? NotificationType::ORGANIZATION_INVITATION_ACCEPTED : NotificationType::ORGANIZATION_INVITATION_REJECTED;
        $title = $accepted ? self::ACCEPTED_TITLE : self::REJECTED_TITLE;
        $body = $accepted
            ? "{$invitee->name} se unió a la organización {$organization->name}."
            : "{$invitation->email} rechazó la invitación a unirse a {$organization->name}.";

        $adminIds = DB::table('organization_user')
            ->where('organization_id', $invitation->organization_id)
            ->where('role', OrganizationRole::ADMIN->value)
            ->where('user_id', '!=', $invitee->id)
            ->orderBy('user_id')
            ->pluck('user_id');

        foreach ($adminIds as $adminId) {
            NotificationService::send(
                $invitee->id,
                (int) $adminId,
                $type,
                $title,
                $body,
                [
                    'invitation_id' => $invitation->id,
                    'organization_id' => $invitation->organization_id,
                ]
            );
        }
    }
}
