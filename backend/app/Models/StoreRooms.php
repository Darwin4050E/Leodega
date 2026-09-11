<?php

namespace App\Models;

use App\Casts\SecurityFeatures;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class StoreRooms extends Model
{
    use HasFactory;
    use SoftDeletes;

    protected $table = 'storeRooms';

    protected $fillable = [
        'landlord_id',
        'room_type',
        'storage_type',
        'direction',
        'city',
        'size',
        'title',
        'description',
        'security',
        'publication_status',
        'publication_date',
        'firefighter_permit_path',
        'cancellation_policy_tier',
        'latitude',
        'longitude',
    ];

    protected $casts = [
        'security' => SecurityFeatures::class,
    ];

    public function landlord()
    {
        return $this->belongsTo(Landlords::class, 'landlord_id');
    }

    public function storePrices()
    {
        return $this->hasMany(StorePrices::class, 'store_room_id');
    }

    public function storePhotos()
    {
        return $this->hasMany(StorePhoto::class, 'store_room_id');
    }

    public function storeDisponibility()
    {
        return $this->hasMany(StoreDisponibility::class, 'store_room_id');
    }

    public function ratings()
    {
        return $this->hasMany(Ratings::class, 'store_id');
    }

    public function moderations()
    {
        return $this->hasMany(StoreModeration::class, 'store_id');
    }

    public function reservations()
    {
        return $this->hasMany(Reservations::class, 'store_room_id');
    }

    /**
     * Single blocking/counting predicate for deletion guard and listing
     * counts: a reservation is "active" when it is confirmed and its
     * end date has not yet passed. Reused by both
     * StoreRoomDeletionService::delete() and every withCount('activeReservations')
     * call site — never duplicate this predicate elsewhere.
     */
    public function activeReservations()
    {
        return $this->hasMany(Reservations::class, 'store_room_id')
            ->where('status', 'confirmed')
            ->whereDate('end_date', '>=', today());
    }

    /**
     * Answers "is this storeroom occupied RIGHT NOW?" — confirmed
     * reservations whose date range contains today
     * (start_date <= today <= end_date).
     *
     * This is NOT the deletion guard. activeReservations() (see its
     * docblock above) intentionally also counts FUTURE confirmed
     * reservations, because deletion must be blocked by any upcoming
     * booking, not only a current one. This predicate answers a strictly
     * narrower, present-tense question and must never replace or be merged
     * into activeReservations() (Engram obs #217).
     */
    public function currentlyOccupiedReservations()
    {
        return $this->hasMany(Reservations::class, 'store_room_id')
            ->where('status', 'confirmed')
            ->whereDate('start_date', '<=', today())
            ->whereDate('end_date', '>=', today());
    }

    /**
     * Single visibility predicate for the two public listing call sites
     * (StoreRoomsController::index() and ::getByLandlord()): a storeroom is
     * visible to a viewer when the viewer is an admin, when the viewer is
     * the owning landlord of the id being browsed, or when the storeroom
     * is `approved`. Reused by both call sites — never duplicate this
     * predicate inline, mirroring the precedent already set on
     * StoreRooms::activeReservations() above.
     *
     * $viewer is taken as an explicit argument rather than resolved inside
     * the scope, which keeps this unit-testable without HTTP and keeps the
     * guard-resolution choice visible at exactly the two call sites.
     */
    public function scopeVisibleTo($query, ?User $viewer, ?int $ownerLandlordId = null)
    {
        if ($viewer?->role === 'admin') {
            return $query;
        }

        if ($ownerLandlordId !== null && $viewer?->landlord?->id === $ownerLandlordId) {
            return $query;
        }

        return $query->where('publication_status', 'approved');
    }
}
