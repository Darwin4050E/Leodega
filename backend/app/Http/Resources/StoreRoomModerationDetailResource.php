<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * The verification expediente shape, shared by GET /store-rooms/pending
 * and GET /store-rooms/{id}/moderation-detail so both endpoints can never
 * drift from each other (StoreRoomQueueItemResource was deleted for this
 * reason — see StoreModerationQueueController).
 *
 * `latitude`/`longitude` are never invented, geocoded, or defaulted: a
 * storeroom predating the coordinate columns simply returns nulls here
 * (spec #162, "Null coordinates degrade gracefully").
 *
 * `security` comes from the SecurityFeatures cast already normalised on
 * the model, so this resource never touches the raw JSON string.
 *
 * `moderation_history` (additive, SDD 2): full prior decision history for
 * this store room, newest first, sourced from `StoreRooms::moderations()`.
 * Every field asserted by `StoreModerationQueueTest.php` today stays
 * unchanged; this is a new top-level key only.
 *
 * `room_type`/`storage_type` (additive, PR1 of SDD 3): raw model columns,
 * exposed as-is for the expediente's listing-type summary.
 */
class StoreRoomModerationDetailResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $monthlyPrice = $this->storePrices->firstWhere('mode', 'month');
        $price = $monthlyPrice?->price ? (float) $monthlyPrice->price : 0.0;

        // Ordering (newest first) is applied by the shared eager-load
        // constraint in StoreModerationQueueController::moderationEagerLoads()
        // — this resource only maps the already-ordered collection.
        $history = $this->moderations
            ->map(fn ($moderation) => [
                'status' => $moderation->status,
                'reason_code' => $moderation->reason_code,
                'reason_rejected' => $moderation->reason_rejected,
                'admin_id' => $moderation->admin_id,
                'moderation_date' => $moderation->moderation_date,
                'permit_waived_at' => $moderation->permit_waived_at,
            ]);

        return [
            'id' => $this->id,
            'title' => $this->title,
            'landlord' => [
                'name' => $this->landlord?->user?->name,
                'email' => $this->landlord?->user?->email,
            ],
            'submitted_at' => $this->publication_date,
            'photos' => $this->storePhotos->map(fn ($photo) => asset('storage/'.$photo->photo_url))->values(),
            'direction' => $this->direction,
            'city' => $this->city,
            'latitude' => $this->latitude !== null ? (float) $this->latitude : null,
            'longitude' => $this->longitude !== null ? (float) $this->longitude : null,
            'size' => $this->size,
            'monthly_price' => $price,
            'leodega_fee' => round($price * 0.10, 2),
            'landlord_share' => round($price * 0.90, 2),
            'description' => $this->description,
            'cancellation_policy_tier' => $this->cancellation_policy_tier,
            'security' => $this->security,
            'permit_attached' => ! is_null($this->firefighter_permit_path),
            'permit_filename' => $this->firefighter_permit_path ? basename($this->firefighter_permit_path) : null,
            'moderation_history' => $history->values(),
            'room_type' => $this->room_type,
            'storage_type' => $this->storage_type,
        ];
    }
}
