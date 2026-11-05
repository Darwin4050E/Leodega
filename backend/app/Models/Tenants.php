<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Tenants extends Model
{
    use HasFactory;

    protected $table = 'tenants';

    protected $fillable = [
        'user_id',
        'search_preference',
    ];
    //

    /**
     * @return BelongsTo<User, $this>
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    /**
     * @return HasMany<Reservations, $this>
     */
    public function reservations(): HasMany
    {
        return $this->hasMany(Reservations::class, 'tenant_id');
    }
}
