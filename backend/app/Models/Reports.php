<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Reports extends Model
{
    //
    use HasFactory;

    protected $table = 'reports';

    protected $fillable = [
        'user_id',
        'store_id',
        'reported_user_id',
        'title',
        'priority',
        'report_type',
        'description',
        'status',
    ];

    /**
     * @return HasMany<ReportEvidences, $this>
     */
    public function evidences(): HasMany
    {
        return $this->hasMany(ReportEvidences::class, 'report_id');
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function reportedUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'reported_user_id');
    }

    /**
     * @return BelongsTo<StoreRooms, $this>
     */
    public function store(): BelongsTo
    {
        return $this->belongsTo(StoreRooms::class, 'store_id');
    }
}
