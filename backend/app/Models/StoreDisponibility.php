<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

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
