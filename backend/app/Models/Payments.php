<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Payments extends Model
{
    //
    use HasFactory;

    protected $table = 'payments';

    protected $fillable = [
        'reservation_id',
        'payment_method',
        'payment_state',
        'payment_date',
    ];

    public function reservation()
    {
        return $this->belongsTo(Reservations::class, 'reservation_id');
    }
}
