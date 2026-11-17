<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Ratings extends Model
{
    use HasFactory;

    protected $table = 'ratings';

    protected $fillable = [
        'store_id',
        'user_id',
        'stars',
        'comment',
    ];

    /**
     * @return BelongsTo<StoreRooms, $this>
     */
    public function storeRooms(): BelongsTo
    {
        return $this->belongsTo(StoreRooms::class, 'store_id');
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }
}
