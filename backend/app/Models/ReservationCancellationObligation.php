<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class ReservationCancellationObligation extends Model
{
    use HasFactory;

    protected $table = 'reservation_cancellation_obligations';

    protected $fillable = [
        'reservation_id',
        'landlord_id',
        'refund_amount',
        'penalty_amount',
        'penalty_rate',
        'reason',
        'settlement_status',
    ];

    protected $casts = [
        'refund_amount' => 'decimal:2',
        'penalty_amount' => 'decimal:2',
        'penalty_rate' => 'decimal:4',
    ];

    public function reservation()
    {
        return $this->belongsTo(Reservations::class, 'reservation_id');
    }

    public function landlord()
    {
        return $this->belongsTo(Landlords::class, 'landlord_id');
    }
}
