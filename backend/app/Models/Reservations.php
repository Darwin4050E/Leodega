<?php

namespace App\Models;

use Carbon\Carbon;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Reservations extends Model
{
    //
    use HasFactory;

    protected $table = 'reservations';

    protected $fillable = [
        'store_room_id',
        'tenant_id',
        'start_date',
        'end_date',
        'status',
        'total_mount',
        'rent_subtotal',
        'cancelation_reason',
        'creation_date',
    ];

    public function storeRooms()
    {
        return $this->belongsTo(StoreRooms::class, 'store_room_id');
    }

    public function tenants()
    {
        return $this->belongsTo(Tenants::class, 'tenant_id');
    }

    public function payments()
    {
        return $this->hasMany(Payments::class, 'reservation_id');
    }

    public function cancellationObligation()
    {
        return $this->hasOne(ReservationCancellationObligation::class, 'reservation_id');
    }

    /**
     * Single definition of the HUG-06 gestor cancellation rule: the
     * reservation must be paid (`confirmed` is only reachable from
     * PaymentService's paid branch), priced (legacy rows have a null
     * rent_subtotal and cannot be refunded), and not yet started —
     * strictly future, so a reservation beginning today is NOT cancellable.
     *
     * Both ReservationService::cancelByLandlord()'s guard and
     * landlordIndex()'s `can_be_cancelled` flag call this. Writing the rule
     * twice is exactly how a UI ends up enabling a button the server then
     * rejects with 409 — and the client cannot compute it on its own,
     * because it does not know what "today" is on the server.
     */
    public function isCancellableByLandlord(): bool
    {
        return $this->status === 'confirmed'
            && $this->rent_subtotal !== null
            && Carbon::parse($this->start_date)->startOfDay()->gt(today());
    }
}
