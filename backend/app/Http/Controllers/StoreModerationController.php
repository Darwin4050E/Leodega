<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreStoreModerationRequest;
use App\Http\Requests\UpdateStoreModerationRequest;
use App\Models\StoreModeration;
use App\Models\StoreRooms;
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
        $validated = $request->validate((new StoreStoreModerationRequest)->rules());

        if (! in_array($validated['status'], ['approved', 'rejected'], true)) {
            return $this->storeModel($request, StoreModeration::class, (new StoreStoreModerationRequest)->rules());
        }

        $storeRoom = StoreRooms::findOrFail($validated['store_id']);

        $moderation = $moderationService->moderate(
            $storeRoom,
            $validated['status'],
            $validated['reason_rejected'] ?? null,
            auth()->id()
        );

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
