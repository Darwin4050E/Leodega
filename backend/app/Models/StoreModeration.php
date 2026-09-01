<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class StoreModeration extends Model
{
    //
    use HasFactory;

    protected $table = 'store_moderation';

    protected $fillable = [
        'store_id',
        'status',
        'reason_rejected',
        'moderation_date',
    ];

    public function storeRoom()
    {
        return $this->belongsTo(StoreRooms::class, 'store_id');
    }
}
