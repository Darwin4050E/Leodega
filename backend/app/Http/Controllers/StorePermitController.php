<?php

namespace App\Http\Controllers;

use App\Models\StoreRooms;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

class StorePermitController extends ApiController
{
    /**
     * Stream the fire-department permit PDF to an authenticated admin user.
     *
     * The permit is written during atomic room registration
     * (StoreRoomService::register) and never uploaded through a separate
     * endpoint. Access is restricted to the admin role via the route
     * middleware (role:admin, same as StoreModerationController and
     * AdminController routes). A landlord MUST NOT be able to download
     * another room's permit.
     */
    public function download(Request $request, $storeRoomId)
    {
        $storeRoom = StoreRooms::findOrFail($storeRoomId);

        if (! $storeRoom->firefighter_permit_path || ! Storage::disk('private')->exists($storeRoom->firefighter_permit_path)) {
            return response()->json(['message' => 'Permit not found'], 404);
        }

        return Storage::disk('private')->download(
            $storeRoom->firefighter_permit_path,
            "permit_room_{$storeRoomId}.pdf"
        );
    }
}
