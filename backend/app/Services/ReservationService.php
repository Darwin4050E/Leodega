<?php

namespace App\Services;

use App\Enums\NotificationType;
use App\Exceptions\ReservationConflictException;
use App\Models\Reservations;
use App\Models\StoreRooms;
use App\Models\Tenants;

class ReservationService
{
    /**
     * Extraído de ReservationsController::store: crea la reserva si no hay
     * conflicto de fechas con otra reserva confirmada, y notifica al
     * landlord dueño de la bodega.
     *
     * @throws ReservationConflictException si ya hay una reserva confirmada
     *                                      que se solapa con el rango solicitado.
     */
    public function create(Tenants $tenant, StoreRooms $room, array $data, ?int $actingUserId): Reservations
    {
        $hasConflict = Reservations::where('store_room_id', $room->id)
            ->where('status', 'confirmed')
            ->whereDate('start_date', '<=', $data['end_date'])
            ->whereDate('end_date', '>=', $data['start_date'])
            ->exists();

        if ($hasConflict) {
            throw new ReservationConflictException('La bodega ya está reservada en esas fechas.');
        }

        $reservation = Reservations::create([
            'store_room_id' => $room->id,
            'tenant_id' => $tenant->id,
            'start_date' => $data['start_date'],
            'end_date' => $data['end_date'],
            'status' => 'pending',
            'total_mount' => $data['total_mount'],
            'cancelation_reason' => null,
            'creation_date' => now(),
        ]);

        $room->load('landlord.user');
        if ($room->landlord && $room->landlord->user) {
            NotificationService::send(
                $actingUserId,
                $room->landlord->user->id,
                NotificationType::RESERVATION_REQUEST,
                'Nueva solicitud de reserva',
                'Han solicitado reservar tu bodega',
                [
                    'reservation_id' => $reservation->id,
                    'store_room_id' => $room->id,
                ]
            );
        }

        return $reservation;
    }

    /**
     * Extraído de ReservationsController::updateStatus (rama "confirmed"):
     * confirma la reserva, notifica al tenant, y cancela en cascada
     * cualquier otra reserva "pending" que se solape con las mismas fechas
     * de esta bodega.
     *
     * @throws ReservationConflictException si ya hay OTRA reserva confirmada
     *                                      que se solapa con estas fechas.
     */
    public function confirm(Reservations $reservation, ?int $actingUserId): Reservations
    {
        $hasConfirmedConflict = Reservations::where('store_room_id', $reservation->store_room_id)
            ->where('status', 'confirmed')
            ->where('id', '!=', $reservation->id)
            ->whereDate('start_date', '<=', $reservation->end_date)
            ->whereDate('end_date', '>=', $reservation->start_date)
            ->exists();

        if ($hasConfirmedConflict) {
            throw new ReservationConflictException('Ya existe una reserva confirmada en esas fechas.');
        }

        $reservation->update([
            'status' => 'confirmed',
            'cancelation_reason' => null,
        ]);

        NotificationService::send(
            $actingUserId,
            $reservation->tenants->user->id,
            NotificationType::RESERVATION_CONFIRMED,
            'Reserva confirmada',
            'Tu reserva ha sido confirmada',
            [
                'reservation_id' => $reservation->id,
                'store_room_id' => $reservation->store_room_id,
            ]
        );

        Reservations::where('store_room_id', $reservation->store_room_id)
            ->where('status', 'pending')
            ->where('id', '!=', $reservation->id)
            ->whereDate('start_date', '<=', $reservation->end_date)
            ->whereDate('end_date', '>=', $reservation->start_date)
            ->update([
                'status' => 'canceled',
                'cancelation_reason' => 'Blocked by confirmed reservation',
            ]);

        return $reservation->load(['storeRooms', 'tenants.user']);
    }

    /**
     * Extraído de ReservationsController::updateStatus (rama "canceled"):
     * cancela la reserva y notifica al tenant.
     */
    public function cancel(Reservations $reservation, ?string $reason, ?int $actingUserId): Reservations
    {
        $reservation->update([
            'status' => 'canceled',
            'cancelation_reason' => $reason ?? 'Rejected by landlord',
        ]);

        NotificationService::send(
            $actingUserId,
            $reservation->tenants->user->id,
            NotificationType::RESERVATION_CANCELED,
            'Reserva cancelada',
            $reservation->cancelation_reason,
            [
                'reservation_id' => $reservation->id,
                'store_room_id' => $reservation->store_room_id,
            ]
        );

        return $reservation->load(['storeRooms', 'tenants.user']);
    }
}
