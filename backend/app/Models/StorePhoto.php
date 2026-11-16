<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class StorePhoto extends Model
{
    //
    use HasFactory;

    protected $table = 'store_photo';

    protected $fillable = ['store_room_id', 'photo_url'];

    /**
     * @return BelongsTo<StoreRooms, $this>
     */
    public function storeRooms(): BelongsTo
    {
        return $this->belongsTo(StoreRooms::class, 'store_room_id');
    }
}
