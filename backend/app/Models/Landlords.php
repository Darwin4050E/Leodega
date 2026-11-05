<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Landlords extends Model
{
    use HasFactory;

    protected $table = 'landlords';

    protected $fillable = [
        'user_id',
        'optional_company',
    ];

    // Relation with User
    /**
     * @return BelongsTo<User, $this>
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    /**
     * @return HasMany<StoreRooms, $this>
     */
    public function storeRooms(): HasMany
    {
        return $this->hasMany(StoreRooms::class, 'landlord_id');
    }

    /**
     * @return HasMany<CancelationsPolices, $this>
     */
    public function cancelationPolicies(): HasMany
    {
        return $this->hasMany(CancelationsPolices::class, 'landlord_id');
    }
}
