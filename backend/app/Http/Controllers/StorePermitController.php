<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreStoreRoomRequest;
use App\Models\Landlords;
use App\Models\StoreRooms;
use App\Services\StoreRoomService;
use Illuminate\Http\Request;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Validator;

class StorePermitController extends ApiController
{
    /**
     * Stream the fire-department permit PDF to an authenticated admin user.
     *
     * The permit is first written during atomic room registration
     * (StoreRoomService::register) and can later be replaced only by the
     * owning gestor through replace(). Access is restricted to the admin
     * role via the route middleware (role:admin, same as
     * StoreModerationController routes). A landlord MUST NOT be able to
     * download another room's permit.
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

    /**
     * The owning gestor replaces the permit PDF. Authorization mirrors
     * StoreRoomsController::editListing(): 404 for a missing room or a
     * caller without a landlord profile, 403 when not the owner. Validation
     * reuses the registration rule/messages; status handling lives in
     * StoreRoomService::replacePermit().
     */
    public function replace(Request $request, $storeRoomId, StoreRoomService $service)
    {
        $storeRoom = StoreRooms::find($storeRoomId) ?? abort(404, 'Bodega no encontrada');
        $landlord = Landlords::where('user_id', auth()->id())->firstOrFail();

        Gate::authorize('update', [$storeRoom, $landlord]);

        $validator = Validator::make(
            $request->all(),
            ['firefighter_permit' => StoreStoreRoomRequest::PERMIT_RULE],
            Arr::only((new StoreStoreRoomRequest)->messages(), [
                'firefighter_permit.required',
                'firefighter_permit.mimes',
                'firefighter_permit.max',
            ])
        );

        if ($validator->fails()) {
            return response()->json([
                'message' => 'Validation Error',
                'errors' => $validator->errors(),
            ], 422);
        }

        $updated = $service->replacePermit($storeRoom, $request->file('firefighter_permit'), auth()->id());

        return response()->json([
            'data' => $updated->makeHidden('firefighter_permit_path'),
            'message' => 'El permiso de bomberos se reemplazó correctamente.',
            'status' => 200,
        ], 200);
    }
}
