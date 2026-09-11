<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

/**
 * Semantics undefined: no business logic anywhere in this codebase reads or
 * writes this model. It is NOT the source of `is_available_now` on
 * GET /store-rooms/{id}/detail — that field is computed from
 * StoreRooms::currentlyOccupiedReservations() instead (see its docblock).
 * Marked for deletion in a future, separate cycle; kept here unchanged for
 * now (storeroom-detail-backend, Engram obs #219).
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
