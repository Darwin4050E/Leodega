<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

/**
 * A landlord-authored manual date block on a storeroom they own — an
 * Airbnb-style "unavailable" range that is independent of any reservation.
 * Ownership-scoped via its storeRooms() relation and enforced at write time
 * by StoreDisponibilityController (StoreRoomsPolicy::update ownership check
 * plus StoreRooms::hasConfirmedReservationOverlapping() and block-vs-block
 * overlap rejection). Consumed by ReservationsController::reservedDates(),
 * which unions confirmed reservations with these blocks into one bare
 * `[{start_date, end_date}]` response.
 *
 * It is NOT the source of `is_available_now` on GET /store-rooms/{id}/detail
 * — that field is computed from StoreRooms::currentlyOccupiedReservations()
 * instead (see its docblock).
 */
class StoreDisponibility extends Model
{
    use HasFactory;

    protected $table = 'store_disponibility';

    protected $fillable = [
        'store_room_id',
        'start_date',
        'end_date',
    ];
    //

    public function storeRooms()
    {
        return $this->belongsTo(StoreRooms::class, 'store_room_id');
    }
}
