<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreStorePhotoRequest;
use App\Models\Landlords;
use App\Models\StorePhoto;
use App\Models\StoreRooms;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Validator;

class StorePhotoController extends ApiController
{
    public function index($storeRoomId)
    {
        return StorePhoto::where('store_room_id', $storeRoomId)->get();
    }

    public function show($id)
    {
        return $this->showModel(StorePhoto::class, $id);
    }

    /**
     * 404 for a missing/soft-deleted room or a caller without a Landlord profile,
     * 403 when the caller does not own the room. Runs before any validation or
     * file work; there is no admin override (same rule as StoreRoomsPolicy::update).
     */
    private function authorizeOwnedRoom($roomId): StoreRooms
    {
        $room = StoreRooms::find($roomId) ?? abort(404, 'Bodega no encontrada');
        $landlord = Landlords::where('user_id', auth()->id())->firstOrFail();

        Gate::authorize('update', [$room, $landlord]);

        return $room;
    }

    public function store(Request $request, $storeRoomId)
    {
        $room = $this->authorizeOwnedRoom($storeRoomId);

        $rules = new StoreStorePhotoRequest;
        $validator = Validator::make($request->all(), $rules->rules(), $rules->messages());

        if ($validator->fails()) {
            return response()->json([
                'message' => 'Validation Error',
                'errors' => $validator->errors(),
            ], 422);
        }

        $photosSaved = [];

        DB::transaction(function () use ($request, $room, &$photosSaved) {
            foreach ($request->file('photos') as $photo) {
                $path = $photo->store('store_photos', 'public');

                $photosSaved[] = StorePhoto::create([
                    'store_room_id' => $room->id,
                    'photo_url' => $path,
                ]);
            }
        });

        return response()->json([
            'message' => 'Photos uploaded successfully',
            'data' => $photosSaved,
        ], 201);
    }

    public function update()
    {
        return response()->json([
            'message' => 'Para actualizar una foto, elimina y vuelve a subir',
        ], 405);
    }

    public function destroy($storeRoomId, $photoId)
    {
        $room = $this->authorizeOwnedRoom($storeRoomId);

        $photo = $room->storePhotos()->whereKey($photoId)->first();

        if (! $photo) {
            return response()->json([
                'message' => 'Item not found',
            ], 404);
        }

        Storage::disk('public')->delete($photo->photo_url);
        $photo->delete();

        return response()->json([
            'message' => 'Photo deleted successfully',
        ], 200);
    }
}
