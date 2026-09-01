<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class StoreRooms extends Model
{
    use HasFactory;

    protected $table = 'storeRooms';

    protected $fillable = [
        'landlord_id',
        'room_type',
        'storage_type',
        'direction',
        'city',
        'size',
        'title',
        'description',
        'security',
        'publication_status',
        'publication_date',
    ];

    public function landlord()
    {
        return $this->belongsTo(Landlords::class, 'landlord_id');
    }

    public function storePrices()
    {
        return $this->hasMany(StorePrices::class, 'store_room_id');
    }

    public function storePhotos()
    {
        return $this->hasMany(StorePhoto::class, 'store_room_id');
    }

    public function storeDisponibility()
    {
        return $this->hasMany(StoreDisponibility::class, 'store_room_id');
    }

    public function ratings()
    {
        return $this->hasMany(Ratings::class, 'store_id');
    }

    public function moderations()
    {
        return $this->hasMany(StoreModeration::class, 'store_id');
    }

    public function reservations()
    {
        return $this->hasMany(Reservations::class, 'store_room_id');
    }
}
