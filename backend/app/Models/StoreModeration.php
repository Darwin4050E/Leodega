<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class StoreModeration extends Model
{
    //
    use HasFactory;

    protected $table = 'store_moderation';

    protected $fillable = [
        'store_id',
        'status',
        'reason_rejected',
        'reason_code',
        'admin_id',
        'permit_waived_at',
        'moderation_date',
    ];

    /**
     * @return BelongsTo<StoreRooms, $this>
     */
    public function storeRoom(): BelongsTo
    {
        return $this->belongsTo(StoreRooms::class, 'store_id');
    }

    // Mirrors AccountModeration::admin():
    // resolves the deciding admin for the activity feed. Nullable — both
    // `admin_id` columns are nullable with `nullOnDelete`, and rows
    // predating SDD 2 have none.
    /**
     * @return BelongsTo<User, $this>
     */
    public function admin(): BelongsTo
    {
        return $this->belongsTo(User::class, 'admin_id');
    }
}
