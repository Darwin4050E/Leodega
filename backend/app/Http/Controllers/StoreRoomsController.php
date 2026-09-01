<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreStoreRoomRequest;
use App\Http\Requests\UpdateStoreRoomRequest;
use App\Models\Landlords;
use App\Models\Ratings;
use App\Models\StoreRooms;
use App\Services\StoreModerationService;
use Illuminate\Http\Request;

class StoreRoomsController extends ApiController
{
    public function index()
    {
        return StoreRooms::with(['storePrices', 'storePhotos', 'landlord.user'])
            ->get()
            ->map(function ($room) {
                $ratings = Ratings::where('store_id', $room->id);
                $avg = round($ratings->avg('stars'), 1);
                $count = $ratings->count();

                return [
                    'id' => $room->id,
                    'title' => $room->title,
                    'city' => $room->city,
                    'size' => $room->size,
                    'publication_status' => $room->publication_status,
                    'landlord' => [
                        'id' => $room->landlord?->id,
                        'user' => [
                            'name' => $room->landlord?->user?->name,
                            'email' => $room->landlord?->user?->email,
                            'phone' => $room->landlord?->user?->phone,
                        ],
                    ],
                    'user_id' => $room->landlord?->user?->id,
                    'store_prices' => $room->storePrices,
                    'rating_avg' => $avg,
                    'rating_count' => $count,
                    'image' => $room->storePhotos->first()
                        ? asset('storage/'.$room->storePhotos->first()->photo_url)
                        : null,
                ];
            });
    }

    public function show($id)
    {
        return $this->showModel(StoreRooms::class, $id);
    }

    public function store(Request $request)
    {
        return $this->storeModel($request, StoreRooms::class, (new StoreStoreRoomRequest)->rules());
    }

    /**
     * Corrección de inconsistencia (ver PLAN_CORRECCION_INCONSISTENCIAS.md,
     * Fase 2.1): antes, publication_status se actualizaba vía CRUD genérico
     * sin crear el registro de auditoría StoreModeration ni notificar al
     * landlord. Se mantiene el mismo endpoint/contrato (PUT /storeRooms/{id})
     * para no romper a los clientes existentes: si el payload trae un cambio
     * real de publication_status a approved/rejected, se enruta por
     * StoreModerationService antes de delegar el resto de campos al CRUD
     * genérico heredado.
     */
    public function update(Request $request, $id, StoreModerationService $moderationService)
    {
        $storeRoom = StoreRooms::find($id);
        if (! $storeRoom) {
            return response()->json(['message' => 'Not found', 'status' => 404], 404);
        }

        $newStatus = $request->input('publication_status');
        $isModerationDecision = $newStatus !== null
            && in_array($newStatus, ['approved', 'rejected'], true)
            && $newStatus !== $storeRoom->publication_status;

        if ($isModerationDecision) {
            if (! auth()->user() || auth()->user()->role !== 'admin') {
                return response()->json([
                    'message' => 'Solo un administrador puede aprobar o rechazar una bodega',
                ], 403);
            }

            $request->validate([
                'reason_rejected' => $newStatus === 'rejected' ? 'required|string' : 'nullable|string',
            ]);

            $moderationService->moderate(
                $storeRoom,
                $newStatus,
                $request->input('reason_rejected'),
                auth()->id()
            );

            $request->request->remove('publication_status');
            $request->request->remove('reason_rejected');
        }

        return $this->updateModel($request, StoreRooms::class, $id, (new UpdateStoreRoomRequest)->rules());
    }

    public function destroy($id)
    {
        return $this->destroyModel(StoreRooms::class, $id);
    }

    public function getByLandlord($landlordId)
    {
        $landlord = Landlords::find($landlordId);
        if (! $landlord) {
            return response()->json(['message' => 'Landlord no encontrado'], 404);
        }

        $storeRooms = StoreRooms::with(['storePrices', 'storePhotos', 'storeDisponibility'])
            ->where('landlord_id', $landlordId)
            ->get()
            ->map(function ($room) {
                $firstPhoto = $room->storePhotos->first();

                return [
                    'id' => $room->id,
                    'title' => $room->title,
                    'direction' => $room->direction,
                    'city' => $room->city,
                    'size' => $room->size,
                    'publication_status' => $room->publication_status,
                    'storage_type' => $room->storage_type,
                    'room_type' => $room->room_type,
                    'store_prices' => $room->storePrices,
                    'image' => $firstPhoto ? asset('storage/'.$firstPhoto->photo_url) : null,
                ];
            });

        if ($storeRooms->isEmpty()) {
            return response()->json(['message' => 'No se encontraron bodegas para este landlord'], 404);
        }

        return response()->json($storeRooms, 200);
    }

    public function detail($id)
    {
        $room = StoreRooms::with([
            'storePrices',
            'storePhotos',
            'landlord.user',
        ])->find($id);

        if (! $room) {
            return response()->json(['message' => 'Bodega no encontrada'], 404);
        }

        return response()->json([
            'id' => $room->id,
            'title' => $room->title,
            'description' => $room->description,
            'direction' => $room->direction,
            'city' => $room->city,
            'size' => $room->size,
            'security' => $room->security,
            'room_type' => $room->room_type,
            'storage_type' => $room->storage_type,

            'prices' => $room->storePrices,

            'photos' => $room->storePhotos->map(fn ($p) => asset('storage/'.$p->photo_url)),

            'landlord' => [
                'id' => $room->landlord->id,
                'user_id' => $room->landlord->user->id,
                'name' => $room->landlord->user->name,
                'email' => $room->landlord->user->email,
            ],
        ]);
    }
}
