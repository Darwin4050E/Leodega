<?php

namespace App\Models;

use App\Enums\InvitationStatus;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

/**
 * An invitation for a registered tenant to join an organization. The row is
 * also the audit record, so it is never deleted by a revoke. Written only by
 * OrganizationInvitationService, never from request data.
 */
class OrganizationInvitation extends Model
{
    use HasFactory;

    public const EXPIRY_DAYS = 7;

    protected $fillable = [
        'organization_id',
        'invited_user_id',
        'invited_by_user_id',
        'email',
        'status',
        'expires_at',
        'responded_at',
    ];

    protected function casts(): array
    {
        return [
            'status' => InvitationStatus::class,
            'expires_at' => 'datetime',
            'responded_at' => 'datetime',
        ];
    }

    /**
     * The status as the rest of the world sees it: a stored `pending` whose
     * `expires_at` is now or past reads as `expired`. Expiry is lazy, so there
     * is no job that flips the stored value. Not cached: a revoke changes the
     * stored status on the same instance that was just read.
     */
    protected function effectiveStatus(): Attribute
    {
        return Attribute::get(fn () => $this->status === InvitationStatus::Pending && $this->expires_at->lte(now())
            ? InvitationStatus::Expired
            : $this->status)->withoutObjectCaching();
    }

    public function scopePending(Builder $query): void
    {
        $query->where('status', InvitationStatus::Pending->value)
            ->where('expires_at', '>', now());
    }

    public function organization()
    {
        return $this->belongsTo(Organization::class);
    }

    public function invitee()
    {
        return $this->belongsTo(User::class, 'invited_user_id');
    }

    public function inviter()
    {
        return $this->belongsTo(User::class, 'invited_by_user_id');
    }
}
