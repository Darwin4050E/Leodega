<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreStorePhotoRequest;
use App\Models\StorePhoto;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
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

    public function store(Request $request, $storeRoomId)
    {

        $validator = Validator::make($request->all(), (new StoreStorePhotoRequest)->rules());

        if ($validator->fails()) {
            return response()->json([
                'message' => 'Validation Error',
                'errors' => $validator->errors(),
            ], 400);
        }

        $photosSaved = [];

        DB::transaction(function () use ($request, $storeRoomId, &$photosSaved) {
            foreach ($request->file('photos') as $photo) {
                $path = $photo->store('store_photos', 'public');

                $photosSaved[] = StorePhoto::create([
                    'store_room_id' => $storeRoomId,
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

    public function destroy($id)
    {
        $photo = StorePhoto::find($id);

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
