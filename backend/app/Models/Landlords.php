<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Landlords extends Model
{
    use HasFactory;

    protected $table = 'landlords';

    protected $fillable = [
        'user_id',
        'optional_company',
    ];

    // Relation with User
    public function user()
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    public function storeRooms()
    {
        return $this->hasMany(StoreRooms::class, 'landlord_id');
    }

    public function cancelationPolicies()
    {
        return $this->hasMany(cancelations_polices::class, 'landlord_id');
    }
}
