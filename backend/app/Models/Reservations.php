<?php

namespace App\Models;

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
}
