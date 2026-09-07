<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * The verification expediente for GET /store-rooms/{id}/moderation-detail.
 * New surface only — see StoreRoomQueueItemResource for the same note.
 *
 * `latitude`/`longitude` are never invented, geocoded, or defaulted: a
 * storeroom predating the coordinate columns simply returns nulls here
 * (spec #162, "Null coordinates degrade gracefully").
 *
 * `security` comes from the SecurityFeatures cast already normalised on
 * the model, so this resource never touches the raw JSON string.
 */
class StoreRoomModerationDetailResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $monthlyPrice = $this->storePrices->firstWhere('mode', 'month');
        $price = $monthlyPrice?->price ? (float) $monthlyPrice->price : 0.0;

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
        ];
    }
}
