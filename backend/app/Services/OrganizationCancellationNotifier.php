<?php

namespace App\Services;

use App\Enums\NotificationType;
use App\Models\Reservations;
use App\Models\User;
use App\Notifications\OrganizationReservationCancelledNotification;
use Illuminate\Support\Facades\DB;

/**
 * HUE-06 OR-24/OR-25: tells the gestor and the organization members about an
 * admin cancel in app (inside the cancel transaction) and emails the creator.
 */
class OrganizationCancellationNotifier
{
    /**
     * Sent synchronously, so the caller must run it after the transaction
     * commits and treat a failure as non-fatal.
     */
    public function emailCreator(Reservations $reservation, int $actorId): void
    {
        $reservation->loadMissing('tenants.user');

        $reservation->tenants->user->notify(
            new OrganizationReservationCancelledNotification($reservation, User::findOrFail($actorId))
        );
    }

    public function notifyInApp(Reservations $reservation, int $actorId): void
    {
        $reservation->loadMissing(['organization', 'storeRooms.landlord.user', 'tenants.user']);

        $organization = $reservation->organization;
        $roomTitle = $reservation->storeRooms->title;
        $data = [
            'reservation_id' => $reservation->id,
            'store_room_id' => $reservation->store_room_id,
            'organization_id' => $reservation->organization_id,
        ];

        $gestorId = $reservation->storeRooms->landlord?->user?->id;
        if ($gestorId !== null) {
            NotificationService::send(
                $actorId,
                $gestorId,
                NotificationType::RESERVATION_CANCELED,
                'Reserva cancelada por la organización',
                "{$organization->name} canceló la reserva de {$roomTitle}. Revisa el reembolso correspondiente.",
                $data
            );
        }

        $actorName = User::findOrFail($actorId)->name;
        $creatorName = $reservation->tenants->user->name;
        $body = "{$actorName} canceló la reserva de {$roomTitle} reservada por {$creatorName}. Motivo: {$reservation->cancelation_reason}";

        $memberIds = DB::table('organization_user')
            ->where('organization_id', $reservation->organization_id)
            ->where('user_id', '!=', $actorId)
            ->pluck('user_id')
            ->reject(fn ($userId) => (int) $userId === $gestorId);

        foreach ($memberIds as $memberId) {
            NotificationService::send(
                $actorId,
                $memberId,
                NotificationType::RESERVATION_CANCELED,
                'Reserva de la organización cancelada',
                $body,
                $data
            );
        }
    }
}
