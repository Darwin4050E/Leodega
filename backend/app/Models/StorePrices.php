<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

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

    /**
     * @return BelongsTo<StoreRooms, $this>
     */
    public function storeRooms(): BelongsTo
    {
        return $this->belongsTo(StoreRooms::class, 'store_room_id');
    }
}
