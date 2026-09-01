<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class StorePrices extends Model
{
    use HasFactory;

    protected $table = 'store_prices';

    protected $fillable = [
        'store_room_id',
        'mode',
        'price',
        'disponibility',
    ];

    public function storeRooms()
    {
        return $this->belongsTo(StoreRooms::class, 'store_room_id');
    }
}
