<?php

namespace App\Services;

use App\Exceptions\ReservationConflictException;
use App\Models\Reservations;
use App\Models\StoreRooms;
use Illuminate\Support\Facades\DB;

class StoreRoomDeletionService
{
    /**
     * Soft-deletes a storeroom when it has no blocking reservation, and
     * cascades a cancellation over the remaining pending reservations.
     *
     * The blocking check reuses StoreRooms::activeReservations() — the
     * single source of truth for the "confirmed and not yet ended"
     * predicate, also used by the listing withCount() calls.
     *
     * @throws ReservationConflictException when at least one active/future
     *                                       confirmed reservation exists.
     */
    public function delete(StoreRooms $room): void
    {
        if ($room->activeReservations()->exists()) {
            throw new ReservationConflictException(
                'No se puede eliminar la bodega: tiene reservas confirmadas activas o futuras.'
            );
        }

        DB::transaction(function () use ($room) {
            $room->delete();

            Reservations::where('store_room_id', $room->id)
                ->where('status', 'pending')
                ->update([
                    'status' => 'canceled',
                    'cancelation_reason' => 'Storeroom deleted by landlord',
                ]);
        });
    }
}
