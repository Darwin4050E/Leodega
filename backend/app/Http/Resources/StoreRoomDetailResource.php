<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * GET /store-rooms/{id}/detail response shape (storeroom-detail-backend
 * cycle). Constructed with the already-loaded room plus an externally
 * computed rating summary, so this resource never runs its own ratings
 * query (RatingsService::summaryFor() owns that, shared with index()).
 *
 * `security` is deliberately read via getRawOriginal(), NOT the
 * SecurityFeatures cast used by StoreRoomModerationDetailResource: this
 * endpoint's contract predates the cast and frontend/src/Dashboard/
 * BodegaDetalle.tsx JSON.parse()s this field as a raw string. Serving the
 * cast array here would crash that screen. The typed object is served only
 * by GET /store-rooms/{id}/moderation-detail.
 *
 * `is_available_now` comes from StoreRooms::currentlyOccupiedReservations(),
 * a predicate answering "is this storeroom occupied right now" that is
 * distinct from StoreRooms::activeReservations() (the deletion guard, which
 * intentionally also counts future confirmed reservations). See both
 * relations' docblocks and Engram obs #217.
 */
class StoreRoomDetailResource extends JsonResource
{
    /**
     * @param  array{avg: float, count: int}  $ratingSummary
     */
    public function __construct($resource, private array $ratingSummary)
    {
        parent::__construct($resource);
    }

    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'title' => $this->title,
            'description' => $this->description,
            'direction' => $this->direction,
            'city' => $this->city,
            'size' => $this->size,
            'security' => $this->getRawOriginal('security'),
            'room_type' => $this->room_type,
            'storage_type' => $this->storage_type,
            'active_reservations_count' => $this->active_reservations_count,

            'prices' => $this->storePrices,

            'photos' => $this->storePhotos->map(fn ($p) => asset('storage/'.$p->photo_url)),

            'landlord' => [
                'id' => $this->landlord->id,
                'user_id' => $this->landlord->user->id,
                'name' => $this->landlord->user->name,
                'email' => $this->landlord->user->email,
            ],

            'latitude' => $this->latitude !== null ? (float) $this->latitude : null,
            'longitude' => $this->longitude !== null ? (float) $this->longitude : null,
            'rating_avg' => $this->ratingSummary['avg'],
            'rating_count' => $this->ratingSummary['count'],
            'is_available_now' => ! $this->currentlyOccupiedReservations()->exists(),
        ];
    }
}
