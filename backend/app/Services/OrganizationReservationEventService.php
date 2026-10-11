<?php

namespace App\Services;

use App\Enums\ReservationEventKind;
use App\Models\OrganizationReservationEvent;
use App\Models\Reservations;
use App\Models\User;

/**
 * Writes the organization reservation audit log (HUE-06 OR-21..OR-23). It
 * never swallows an exception: the caller decides whether a failed write may
 * abort the surrounding operation.
 */
class OrganizationReservationEventService
{
    public function recordCancelled(Reservations $reservation, ?int $actorId, ?string $reason): OrganizationReservationEvent
    {
        return OrganizationReservationEvent::create([
            'organization_id' => $reservation->organization_id,
            'reservation_id' => $reservation->id,
            'actor_user_id' => $actorId,
            'kind' => ReservationEventKind::Cancelled,
            'reason' => $reason,
        ]);
    }

    /**
     * Only a member of the reservation's organization is audited: for anyone
     * else, and for a personal reservation, nothing is written.
     */
    public function recordDeniedAttempt(Reservations $reservation, User $actor, string $action): ?OrganizationReservationEvent
    {
        if ($reservation->organization_id === null || $actor->roleInOrganization($reservation->organization_id) === null) {
            return null;
        }

        return OrganizationReservationEvent::create([
            'organization_id' => $reservation->organization_id,
            'reservation_id' => $reservation->id,
            'actor_user_id' => $actor->id,
            'kind' => ReservationEventKind::DeniedAttempt,
            'attempted_action' => $action,
        ]);
    }
}
