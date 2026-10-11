<?php

namespace App\Models;

use App\Enums\ReservationEventKind;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use LogicException;

/**
 * One row of the organization reservation audit log. Append-only: rows are
 * inserted by OrganizationReservationEventService and never modified or
 * removed.
 */
class OrganizationReservationEvent extends Model
{
    use HasFactory;

    public const UPDATED_AT = null;

    public const ACTION_CANCEL = 'cancel';

    public const ACTION_PREVIEW = 'preview';

    // Written only by OrganizationReservationEventService, never from request data.
    protected $fillable = [
        'organization_id',
        'reservation_id',
        'actor_user_id',
        'kind',
        'attempted_action',
        'reason',
    ];

    protected function casts(): array
    {
        return [
            'kind' => ReservationEventKind::class,
        ];
    }

    protected static function booted(): void
    {
        static::updating(function () {
            throw new LogicException('Organization reservation events are append-only and cannot be updated.');
        });

        static::deleting(function () {
            throw new LogicException('Organization reservation events are append-only and cannot be deleted.');
        });
    }

    public function organization()
    {
        return $this->belongsTo(Organization::class);
    }

    public function reservation()
    {
        return $this->belongsTo(Reservations::class, 'reservation_id');
    }

    public function actor()
    {
        return $this->belongsTo(User::class, 'actor_user_id');
    }
}
