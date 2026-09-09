<?php

namespace App\Http\Controllers;

use App\Http\Resources\StoreRoomModerationDetailResource;
use App\Models\StoreRooms;

/**
 * Admin-only pending queue and per-storeroom verification detail
 * (the "expediente"). Both routes sit in the existing
 * ['auth.api:sanctum', 'role:admin'] group in routes/api.php, alongside
 * /store_moderation/* and the permit download.
 *
 * These actions return StoreRooms, not StoreModeration records, so they
 * do not belong on StoreModerationController (design #163 section 1).
 */
class StoreModerationQueueController extends Controller
{
    /**
     * Shared eager-load shape for both pending() and moderationDetail(),
     * including the `moderations` ordering constraint (newest first).
     * Keeping this in one place makes it structurally impossible for one
     * endpoint to gain the ordering constraint while the other doesn't.
     */
    private function moderationEagerLoads(): array
    {
        return [
            'storePrices',
            'storePhotos',
            'landlord.user',
            'moderations' => fn ($query) => $query->orderByDesc('moderation_date')->orderByDesc('id'),
        ];
    }

    /**
     * Strictly `pending` storerooms. Deliberately does NOT use
     * ApiController::indexModel(): that helper 404s on an empty
     * collection, and an empty moderation queue is a normal state — it
     * must serialise to `200 []`.
     */
    public function pending()
    {
        $rooms = StoreRooms::with($this->moderationEagerLoads())
            ->where('publication_status', 'pending')
            ->get();

        // ->resolve() on each resource, rather than
        // StoreRoomModerationDetailResource::collection(), sidesteps
        // Laravel's default `{"data": [...]}` envelope so an empty queue
        // serialises to bare `200 []`, matching the rest of this
        // controller family (StoreRoomsController never wraps either).
        $items = $rooms->map(fn ($room) => (new StoreRoomModerationDetailResource($room))->resolve());

        return response()->json($items->values(), 200);
    }

    public function moderationDetail($id)
    {
        $room = StoreRooms::with($this->moderationEagerLoads())->find($id);

        if (! $room) {
            return response()->json(['message' => 'Bodega no encontrada', 'status' => 404], 404);
        }

        return response()->json((new StoreRoomModerationDetailResource($room))->resolve(), 200);
    }
}
