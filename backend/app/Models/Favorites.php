<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Favorites extends Model
{
    //
    use HasFactory;

    protected $table = 'favorites';

    protected $fillable = ['user_id', 'store_room_id', 'save_date'];

    /**
     * @return BelongsTo<User, $this>
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    /**
     * @return BelongsTo<StoreRooms, $this>
     */
    public function storeRooms(): BelongsTo
    {
        return $this->belongsTo(StoreRooms::class, 'store_room_id');
    }
}
