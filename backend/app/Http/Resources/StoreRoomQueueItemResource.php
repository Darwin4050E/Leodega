<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Queue list item shape for GET /store-rooms/pending. New surface only —
 * the existing index()/detail()/getByLandlord() inline shaping is
 * deliberately left untouched (design #163 section 2).
 */
class StoreRoomQueueItemResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $firstPhoto = $this->storePhotos->first();

        return [
            'id' => $this->id,
            'title' => $this->title,
            'city' => $this->city,
            'size' => $this->size,
            'submitted_at' => $this->publication_date,
            'landlord' => [
                'name' => $this->landlord?->user?->name,
                'email' => $this->landlord?->user?->email,
            ],
            'image' => $firstPhoto ? asset('storage/'.$firstPhoto->photo_url) : null,
        ];
    }
}
