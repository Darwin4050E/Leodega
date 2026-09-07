<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreStoreModerationRequest;
use App\Http\Requests\UpdateStoreModerationRequest;
use App\Models\StoreModeration;
use App\Models\StoreRooms;
use App\Services\ModerationDecision;
use App\Services\StoreModerationService;
use Illuminate\Http\Request;

class StoreModerationController extends ApiController
{
    //
    public function index()
    {
        return $this->indexModel(StoreModeration::class);
    }

    public function show($id)
    {
        return $this->showModel(StoreModeration::class, $id);
    }

    /**
     * Corrección de inconsistencia (ver PLAN_CORRECCION_INCONSISTENCIAS.md,
     * Fase 2.1): antes, este endpoint creaba el registro de auditoría sin
     * tocar StoreRooms.publication_status ni notificar al landlord -- podía
     * desincronizarse del estado real de la bodega. Para decisiones
     * approved/rejected se enruta por el mismo StoreModerationService que ya
     * usa StoreRoomsController::update(), manteniendo una sola fuente de
     * verdad sin importar cuál de los dos endpoints se use.
     */
    public function store(Request $request, StoreModerationService $moderationService)
    {
        // Raw pre-validation peek (mirrors StoreRoomsController::update()'s
        // own idiom, design decision #2): the permit-waiver precondition is
        // room state, not request state, so it must be known before the
        // shared rules bag runs. `find()`, not `findOrFail()` — a garbage
        // `store_id` leaves `$room` null and `permitMissing` false, and the
        // real `'store_id' => 'required|exists:storeRooms,id'` rule still
        // catches it below, producing the same 422 as before this change.
        $rawStatus = $request->input('status');
        $rawStoreId = $request->input('store_id');
        $room = $rawStoreId ? StoreRooms::find($rawStoreId) : null;

        $rules = (new StoreStoreModerationRequest)->rules($rawStatus, is_null($room?->firefighter_permit_path));
        $validated = $request->validate($rules);

        if (! in_array($validated['status'], ['approved', 'rejected'], true)) {
            return $this->storeModel($request, StoreModeration::class, $rules);
        }

        $storeRoom = StoreRooms::findOrFail($validated['store_id']);

        $moderation = $moderationService->moderate($storeRoom, new ModerationDecision(
            decision: $validated['status'],
            reason: $validated['reason_rejected'] ?? null,
            reasonCode: $validated['reason_code'] ?? null,
            adminId: auth()->id(),
            permitWaiverAcknowledged: (bool) ($validated['permit_waiver_acknowledged'] ?? false),
        ));

        return response()->json([
            'item' => $moderation,
            'message' => 'Item created successfully',
            'status' => 201,
        ], 201);
    }

    public function update(Request $request, $id)
    {
        return $this->updateModel($request, StoreModeration::class, $id, (new UpdateStoreModerationRequest)->rules());
    }

    public function destroy($id)
    {
        return $this->destroyModel(StoreModeration::class, $id);
    }
}
