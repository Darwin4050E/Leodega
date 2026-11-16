<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

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

    /**
     * @return BelongsTo<Reservations, $this>
     */
    public function reservation(): BelongsTo
    {
        return $this->belongsTo(Reservations::class, 'reservation_id');
    }

    /**
     * @return BelongsTo<Landlords, $this>
     */
    public function landlord(): BelongsTo
    {
        return $this->belongsTo(Landlords::class, 'landlord_id');
    }
}
