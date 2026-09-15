<?php

namespace App\Http\Controllers;

use App\Http\Requests\EditStoreRoomListingRequest;
use App\Http\Requests\ModerationDecisionRules;
use App\Http\Requests\StoreStoreRoomRequest;
use App\Http\Requests\UpdateStoreRoomRequest;
use App\Http\Resources\StoreRoomDetailResource;
use App\Models\Landlords;
use App\Models\StoreRooms;
use App\Services\ModerationDecision;
use App\Services\StoreModerationService;
use App\Services\RatingsService;
use App\Services\ReservationPricingService;
use App\Services\StoreRoomDeletionService;
use App\Services\StoreRoomService;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\ValidationException;

class StoreRoomsController extends ApiController
{
    /**
     * HUC-01: `city`, `min_size`, `min_price`, `max_price`, `lat`, `lng` are
     * all optional and independently combinable (spec "Filtered Storage Room
     * Search"). A param-less call MUST stay byte-identical to the pre-change
     * response — this is the PR's backward-compatibility contract, so every
     * filter below is additive and only narrows the `visibleTo()` base query.
     *
     * `min_price`/`max_price` filter on the `month`-mode row only (design
     * decision #3/#4): indexing `store_prices[0]` is the bug this change
     * fixes on the frontend side, and filtering must not reintroduce it here.
     *
     * Distance is never SQL — Haversine runs in PHP over the already-loaded
     * page (design decision #5), and only when both `lat`/`lng` are supplied.
     * Rooms with null coordinates keep `distance_km: null` instead of being
     * dropped (spec "Distance Calculation and Null-Coordinate Handling").
     */
    public function index(Request $request)
    {
        // Resolved explicitly via the sanctum guard, never bare auth()->user():
        // this route stays unmiddlewared (the public catalog must remain
        // anonymously reachable), and config/auth.php sets the default guard
        // to `web`, so a bare call would silently return null for a valid
        // Bearer token and downgrade an admin to the anonymous branch.
        $viewer = auth('sanctum')->user();

        $filters = $request->validate([
            'city' => 'sometimes|string|max:255',
            'min_size' => 'sometimes|numeric|min:0',
            'min_price' => 'sometimes|numeric|min:0',
            'max_price' => 'sometimes|numeric|min:0|gte:min_price',
            'lat' => 'sometimes|numeric|between:-90,90|required_with:lng',
            'lng' => 'sometimes|numeric|between:-180,180|required_with:lat',
        ]);

        $query = StoreRooms::with(['storePrices', 'storePhotos', 'landlord.user'])
            ->withCount('activeReservations')
            ->visibleTo($viewer);

        if (array_key_exists('city', $filters)) {
            $query->where('city', $filters['city']);
        }

        if (array_key_exists('min_size', $filters)) {
            $query->where('size', '>=', $filters['min_size']);
        }

        if (array_key_exists('min_price', $filters) || array_key_exists('max_price', $filters)) {
            $query->whereHas('storePrices', function ($priceQuery) use ($filters) {
                $priceQuery->where('mode', 'month');

                if (array_key_exists('min_price', $filters)) {
                    $priceQuery->where('price', '>=', $filters['min_price']);
                }

                if (array_key_exists('max_price', $filters)) {
                    $priceQuery->where('price', '<=', $filters['max_price']);
                }
            });
        }

        $lat = $filters['lat'] ?? null;
        $lng = $filters['lng'] ?? null;

        return $query->get()
            ->map(function ($room) use ($lat, $lng) {
                $ratingSummary = (new RatingsService)->summaryFor($room->id);
                $monthlyPrice = $room->storePrices->firstWhere('mode', 'month');

                return [
                    'id' => $room->id,
                    'title' => $room->title,
                    'direction' => $room->direction,
                    'city' => $room->city,
                    'size' => $room->size,
                    'room_type' => $room->room_type,
                    'storage_type' => $room->storage_type,
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
                    'monthly_price' => $monthlyPrice?->price !== null ? (float) $monthlyPrice->price : null,
                    'latitude' => $room->latitude !== null ? (float) $room->latitude : null,
                    'longitude' => $room->longitude !== null ? (float) $room->longitude : null,
                    'distance_km' => ($lat !== null && $lng !== null && $room->latitude !== null && $room->longitude !== null)
                        ? $this->haversineKm((float) $lat, (float) $lng, (float) $room->latitude, (float) $room->longitude)
                        : null,
                    'rating_avg' => $ratingSummary['avg'],
                    'rating_count' => $ratingSummary['count'],
                    'active_reservations_count' => $room->active_reservations_count,
                    'image' => $room->storePhotos->first()
                        ? asset('storage/'.$room->storePhotos->first()->photo_url)
                        : null,
                ];
            });
    }

    /**
     * Great-circle distance between two coordinate pairs, in kilometers.
     * Post-query, PHP-side only (design decision #5) — no DB-level geo
     * indexing or spatial functions, per proposal's out-of-scope list.
     */
    private function haversineKm(float $lat1, float $lng1, float $lat2, float $lng2): float
    {
        $earthRadiusKm = 6371;

        $dLat = deg2rad($lat2 - $lat1);
        $dLng = deg2rad($lng2 - $lng1);

        $a = sin($dLat / 2) ** 2
            + cos(deg2rad($lat1)) * cos(deg2rad($lat2)) * sin($dLng / 2) ** 2;
        $c = 2 * atan2(sqrt($a), sqrt(1 - $a));

        return round($earthRadiusKm * $c, 2);
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
            ], 422);
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
            return response()->json(['message' => 'Not found'], 404);
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
            ], 422);
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
            return response()->json(['message' => 'Bodega no encontrada'], 404);
        }

        $landlord = Landlords::where('user_id', auth()->id())->firstOrFail();

        Gate::authorize('delete', [$room, $landlord]);

        $deletionService->delete($room);

        return response()->json(['message' => 'Bodega eliminada correctamente', 'status' => 200], 200);
    }

    /**
     * SDD 2, decision #172.1/addendum #174.3: explicit, empty-body state
     * transition for a rejected listing's owning gestor. Deliberately
     * separate from editListing() — the gestor edits fields there first,
     * then calls this as its own action, never accepting listing fields.
     *
     * Ownership (403) and "not currently rejected" (409) are two SEPARATE
     * failures per spec #175: StoreRoomsPolicy::resubmit() checks ownership
     * ONLY, and StoreRoomService::resubmit() throws the 409 conflict. Do
     * NOT collapse these into one gate/response.
     */
    public function resubmit($id, StoreRoomService $service)
    {
        $storeRoom = StoreRooms::find($id);
        if (! $storeRoom) {
            return response()->json(['message' => 'Bodega no encontrada'], 404);
        }

        $landlord = Landlords::where('user_id', auth()->id())->firstOrFail();

        Gate::authorize('resubmit', [$storeRoom, $landlord]);

        $room = $service->resubmit($storeRoom, auth()->id());

        return response()->json([
            'data' => $room,
            'message' => 'La bodega fue reenviada a revisión.',
            'status' => 200,
        ], 200);
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

        return response()->json($storeRooms, 200);
    }

    public function detail($id, RatingsService $ratingsService)
    {
        $room = StoreRooms::with([
            'storePrices',
            'storePhotos',
            'landlord.user',
        ])->withCount('activeReservations')->find($id);

        if (! $room) {
            return response()->json(['message' => 'Bodega no encontrada'], 404);
        }

        $ratingSummary = $ratingsService->summaryFor($room->id);

        return response()->json((new StoreRoomDetailResource($room, $ratingSummary))->resolve(), 200);
    }

    /**
     * Public, read-only price preview (storeroom-detail-pricing). Reuses
     * ReservationPricingService::quote() verbatim — this controller never
     * recomputes or approximates any figure the service already owns.
     *
     * `start_date`/`end_date` are optional together; when both are absent,
     * the panel's default 3-month estimate is computed HERE, server-side
     * (design decision), so the frontend never does date math. When the
     * pricing service finds no eligible `mode='month'` price row it throws
     * ReservationPricingException, deliberately left UNCAUGHT here — its own
     * render() already returns the correct {message} 422 shape, matching the
     * existing pattern in ReservationsController::store().
     */
    public function quote(Request $request, $id, ReservationPricingService $pricingService)
    {
        $room = StoreRooms::find($id);
        if (! $room) {
            return response()->json(['message' => 'Bodega no encontrada'], 404);
        }

        $dates = $request->validate([
            'start_date' => 'sometimes|required_with:end_date|date',
            'end_date' => 'sometimes|required_with:start_date|date|after_or_equal:start_date',
        ]);

        if (! isset($dates['start_date'], $dates['end_date'])) {
            $start = Carbon::now();
            $end = $start->copy()->addMonths(3);
        } else {
            $start = Carbon::parse($dates['start_date']);
            $end = Carbon::parse($dates['end_date']);
        }

        $quote = $pricingService->quote($room, $start->toDateString(), $end->toDateString());

        return response()->json($quote, 200);
    }
}
