<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Favorites extends Model
{
    //
    use HasFactory;

    protected $table = 'favorites';

    protected $fillable = ['user_id', 'store_room_id', 'save_date'];

    public function user()
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    public function storeRooms()
    {
        return $this->belongsTo(StoreRooms::class, 'store_room_id');
    }
}
