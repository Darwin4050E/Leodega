<?php

namespace App\Http\Controllers;

use App\Exceptions\ReservationConflictException;
use App\Http\Requests\EditStoreRoomListingRequest;
use App\Http\Requests\ModerationDecisionRules;
use App\Http\Requests\StoreStoreRoomRequest;
use App\Http\Requests\UpdateStoreRoomRequest;
use App\Models\Landlords;
use App\Models\Ratings;
use App\Models\StoreRooms;
use App\Services\ModerationDecision;
use App\Services\StoreModerationService;
use App\Services\StoreRoomDeletionService;
use App\Services\StoreRoomService;
use Illuminate\Http\Request;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\ValidationException;

class StoreRoomsController extends ApiController
{
    public function index()
    {
        // Resolved explicitly via the sanctum guard, never bare auth()->user():
        // this route stays unmiddlewared (the public catalog must remain
        // anonymously reachable), and config/auth.php sets the default guard
        // to `web`, so a bare call would silently return null for a valid
        // Bearer token and downgrade an admin to the anonymous branch.
        $viewer = auth('sanctum')->user();

        return StoreRooms::with(['storePrices', 'storePhotos', 'landlord.user'])
            ->withCount('activeReservations')
            ->visibleTo($viewer)
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
                    'active_reservations_count' => $room->active_reservations_count,
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

    /**
     * HUG-04: ya no delega en el motor genérico storeModel (D1). El request
     * multipart trae, además de los campos planos, el archivo del permiso
     * de bomberos y los precios anidados como notación de corchetes
     * (storePrices[0][mode], storePrices[0][price], storePrices[0][disponibility]).
     * PHP/Laravel parsean esa notación de forma nativa, así que
     * $request->input('storePrices') devuelve el mismo array anidado que
     * antes bajo JSON (D12) — no se necesita parseo adicional aquí.
     */
    public function store(StoreStoreRoomRequest $request, StoreRoomService $service)
    {
        $landlord = Landlords::where('user_id', $request->user()->id)->first();

        if (! $landlord) {
            return response()->json([
                'message' => 'No tienes un registro de landlord asociado a tu cuenta',
                'status' => 403,
            ], 403);
        }

        try {
            $room = $service->register(
                $landlord,
                Arr::except($request->validated(), ['firefighter_permit']),
                $request->input('storePrices'),
                $request->file('firefighter_permit'),
                auth()->id()
            );
        } catch (ValidationException $e) {
            return response()->json([
                'message' => 'Validation Error',
                'errors' => $e->errors(),
                'status' => 400,
            ], 400);
        }

        return response()->json([
            'item' => $room,
            'message' => 'Item created successfully',
            'status' => 201,
        ], 201);
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
    public function update(Request $request, $id, StoreModerationService $moderationService, StoreRoomService $service)
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

            $rules = (new ModerationDecisionRules)->rules($newStatus, is_null($storeRoom->firefighter_permit_path));
            $request->validate($rules);

            $moderationService->moderate($storeRoom, new ModerationDecision(
                decision: $newStatus,
                reason: $request->input('reason_rejected'),
                reasonCode: $request->input('reason_code'),
                adminId: auth()->id(),
                permitWaiverAcknowledged: filter_var($request->input('permit_waiver_acknowledged'), FILTER_VALIDATE_BOOLEAN),
            ));

            $request->request->remove('publication_status');
            $request->request->remove('reason_rejected');
            $request->request->remove('reason_code');
            $request->request->remove('permit_waiver_acknowledged');

            return $this->updateModel($request, StoreRooms::class, $id, (new UpdateStoreRoomRequest)->rules());
        }

        return $this->editListing($storeRoom, $service);
    }

    /**
     * HUG-08: non-moderation edit path. The owning gestor updates one or
     * more editable fields (title, description, size, monthly price +
     * disponibility) of a storeroom they already published.
     *
     * Authorization mirrors destroy(): resolve the caller's Landlords via
     * firstOrFail() (404 when the account has no landlord profile), then
     * Gate::authorize('update', ...) (403 when not the owner). The route
     * stays on the plain auth.api:sanctum group so the admin moderation
     * branch above keeps reaching this action.
     *
     * Editing is never blocked by existing reservations: their pricing is
     * already snapshotted at creation (ReservationPricingService), so
     * confirmed contracts keep their agreed terms. When the room has
     * active (confirmed + not yet ended) reservations, the response adds an
     * informational `notice` making that explicit (acceptance criterion 3).
     */
    private function editListing(StoreRooms $storeRoom, StoreRoomService $service)
    {
        $landlord = Landlords::where('user_id', auth()->id())->firstOrFail();

        Gate::authorize('update', [$storeRoom, $landlord]);

        $data = app(EditStoreRoomListingRequest::class)->validated();

        try {
            $updated = $service->updateListing($storeRoom, $data);
        } catch (ValidationException $e) {
            return response()->json([
                'message' => 'Validation Error',
                'errors' => $e->errors(),
                'status' => 400,
            ], 400);
        }

        $payload = [
            'data' => $updated,
            'message' => 'Los cambios se guardaron correctamente.',
            'status' => 200,
        ];

        if ($storeRoom->activeReservations()->exists()) {
            $payload['notice'] = 'Los cambios no afectan a las reservas ya confirmadas; solo aplican a nuevas reservas.';
        }

        return response()->json($payload, 200);
    }

    /**
     * Guarded soft delete: only the owning landlord may delete, and only
     * when the storeroom has no active/future confirmed reservation.
     */
    public function destroy($id, StoreRoomDeletionService $deletionService)
    {
        $room = StoreRooms::find($id);
        if (! $room) {
            return response()->json(['message' => 'Bodega no encontrada', 'status' => 404], 404);
        }

        $landlord = Landlords::where('user_id', auth()->id())->firstOrFail();

        Gate::authorize('delete', [$room, $landlord]);

        try {
            $deletionService->delete($room);
        } catch (ReservationConflictException $e) {
            return response()->json(['message' => $e->getMessage()], 409);
        }

        return response()->json(['message' => 'Bodega eliminada correctamente', 'status' => 200], 200);
    }

    public function getByLandlord($landlordId)
    {
        $landlord = Landlords::find($landlordId);
        if (! $landlord) {
            return response()->json(['message' => 'Landlord no encontrado'], 404);
        }

        // Same guard-resolution rule as index(): auth('sanctum')->user(),
        // never bare auth()->user() — see the comment there.
        $viewer = auth('sanctum')->user();

        $storeRooms = StoreRooms::with(['storePrices', 'storePhotos', 'storeDisponibility'])
            ->withCount('activeReservations')
            ->where('landlord_id', $landlordId)
            ->visibleTo($viewer, (int) $landlordId)
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
                    'active_reservations_count' => $room->active_reservations_count,
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
        ])->withCount('activeReservations')->find($id);

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
            // Raw string, NOT the SecurityFeatures-cast array: this endpoint's
            // contract predates the cast and BodegaDetalle.tsx JSON.parse()s
            // this field. The typed object is served only by the new
            // /store-rooms/{id}/moderation-detail endpoint.
            'security' => $room->getRawOriginal('security'),
            'room_type' => $room->room_type,
            'storage_type' => $room->storage_type,
            'active_reservations_count' => $room->active_reservations_count,

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
