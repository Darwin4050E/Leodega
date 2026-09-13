<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreStoreDisponibilityRequest;
use App\Http\Requests\UpdateStoreDisponibilityRequest;
use App\Models\Landlords;
use App\Models\StoreDisponibility;
use App\Models\StoreRooms;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Validator;

class StoreDisponibilityController extends ApiController
{
    /**
     * Ownership-scoped listing (obs #263): returns the authenticated
     * landlord's own blocks, across all their storerooms, and 200 [] when
     * they have none. Deliberately bypasses ApiController::indexModel(),
     * which 404s on an empty collection — an empty block list is the
     * initial, normal state for every landlord. indexModel() itself is
     * left untouched; that defect generalizes to other list endpoints and
     * is out of scope for this cycle.
     */
    public function index()
    {
        $landlord = Landlords::where('user_id', auth()->id())->first();
        if (! $landlord) {
            return response()->json([
                'message' => 'No tienes un registro de landlord asociado a tu cuenta',
            ], 403);
        }

        $blocks = StoreDisponibility::whereHas(
            'storeRooms',
            fn ($q) => $q->where('landlord_id', $landlord->id)
        )->get();

        return response()->json($blocks, 200);
    }

    public function show($id)
    {
        return $this->showModel(StoreDisponibility::class, $id);
    }

    /**
     * Ownership-scoped block creation (obs #263/#264): resolves the target
     * StoreRooms from the validated store_room_id, authorizes via
     * StoreRoomsPolicy::update (same ownership-only check as
     * StoreRoomsController::editListing()), then rejects the request with
     * 422 when it overlaps a confirmed reservation
     * (StoreRooms::hasConfirmedReservationOverlapping()) or an existing
     * block on the same storeroom.
     *
     * This method and the store_id -> store_room_id fix in
     * StoreStoreDisponibilityRequest land together: routes/api.php:148-152
     * guards these write routes with auth.api:sanctum only, no ownership
     * check, so fixing the field name without this authorization would be
     * a live cross-tenant write vulnerability.
     *
     * Landlord resolution deliberately returns 403 (not 404-via-firstOrFail)
     * when the caller has no Landlords row: mirrors
     * StoreRoomsController::store()'s "no tienes un registro de landlord"
     * convention, since this is an authorization boundary (any non-landlord
     * account, e.g. a tenant) rather than a missing-resource case.
     */
    public function store(Request $request)
    {
        $validator = Validator::make($request->all(), (new StoreStoreDisponibilityRequest)->rules());
        if ($validator->fails()) {
            return response()->json([
                'message' => 'Validation Error',
                'errors' => $validator->errors(),
            ], 422);
        }

        $validated = $validator->validated();

        $room = StoreRooms::findOrFail($validated['store_room_id']);

        $landlord = $this->authorizeLandlordOwner($room);
        if ($landlord instanceof JsonResponse) {
            return $landlord;
        }

        $overlap = $this->rejectIfOverlapping($room, $validated['start_date'], $validated['end_date']);
        if ($overlap) {
            return $overlap;
        }

        $block = StoreDisponibility::create($validated);

        return response()->json([
            'item' => $block,
            'message' => 'Item created successfully',
            'status' => 201,
        ], 201);
    }

    /**
     * Same ownership shape as store(): the storeroom is resolved through
     * the block's own storeRooms relation instead of the request payload,
     * so a landlord cannot retarget someone else's block by sending a
     * different store_room_id.
     */
    public function update(Request $request, $id)
    {
        $block = StoreDisponibility::find($id);
        if (! $block) {
            return response()->json(['message' => 'Item not found'], 404);
        }

        $rules = array_map(function ($r) {
            return stripos($r, 'sometimes') === false && stripos($r, 'required') === false
                ? 'sometimes|'.$r
                : $r;
        }, (new UpdateStoreDisponibilityRequest)->rules());

        $validator = Validator::make($request->all(), $rules);
        if ($validator->fails()) {
            return response()->json([
                'message' => 'Validation Error',
                'errors' => $validator->errors(),
            ], 422);
        }

        $validated = $validator->validated();

        $room = $block->storeRooms;

        $landlord = $this->authorizeLandlordOwner($room);
        if ($landlord instanceof JsonResponse) {
            return $landlord;
        }

        $startDate = $validated['start_date'] ?? $block->start_date;
        $endDate = $validated['end_date'] ?? $block->end_date;

        $overlap = $this->rejectIfOverlapping($room, $startDate, $endDate, excludeBlockId: $block->id);
        if ($overlap) {
            return $overlap;
        }

        $block->update($validated);

        return response()->json([
            'data' => $block->fresh(),
            'message' => 'Updated successfully',
            'status' => 200,
        ], 200);
    }

    /**
     * Ownership-scoped deletion. Deliberately skips the overlap check:
     * freeing previously blocked dates can never create a new conflict.
     */
    public function destroy($id)
    {
        $block = StoreDisponibility::find($id);
        if (! $block) {
            return response()->json(['message' => 'Item not found'], 404);
        }

        $landlord = $this->authorizeLandlordOwner($block->storeRooms);
        if ($landlord instanceof JsonResponse) {
            return $landlord;
        }

        $block->delete();

        return response()->json(['message' => 'Item deleted successfully', 'status' => 200], 200);
    }

    /**
     * Resolves the caller's Landlords profile and authorizes them as the
     * owner of $room via StoreRoomsPolicy::update. Returns the Landlords
     * model on success, or a JsonResponse (403) when the caller has no
     * landlord profile at all or does not own $room.
     */
    private function authorizeLandlordOwner(StoreRooms $room): Landlords|JsonResponse
    {
        $landlord = Landlords::where('user_id', auth()->id())->first();
        if (! $landlord) {
            return response()->json([
                'message' => 'No tienes un registro de landlord asociado a tu cuenta',
            ], 403);
        }

        Gate::authorize('update', [$room, $landlord]);

        return $landlord;
    }

    /**
     * Rejects a proposed block range that overlaps a confirmed reservation
     * or an existing block on the same storeroom, using the inclusive
     * boundary rule verified in ReservationService.php:31-35. Returns a 422
     * JsonResponse when rejected, or null when the range is clear.
     */
    private function rejectIfOverlapping(StoreRooms $room, string $startDate, string $endDate, ?int $excludeBlockId = null): ?JsonResponse
    {
        if ($room->hasConfirmedReservationOverlapping($startDate, $endDate)) {
            $message = 'No se puede bloquear este rango de fechas porque se superpone con una reserva confirmada. '.
                'Para liberar estas fechas, cancela la reserva desde la sección de reservas; '.
                'se aplicarán las penalidades de la política de cancelación vigente.';

            return response()->json([
                'message' => $message,
                'errors' => ['dates' => [$message]],
            ], 422);
        }

        $overlapsExistingBlock = StoreDisponibility::where('store_room_id', $room->id)
            ->when($excludeBlockId, fn ($q) => $q->where('id', '!=', $excludeBlockId))
            ->whereDate('start_date', '<=', $endDate)
            ->whereDate('end_date', '>=', $startDate)
            ->exists();

        if ($overlapsExistingBlock) {
            $message = 'Este rango de fechas se superpone con un bloqueo existente en esta bodega.';

            return response()->json([
                'message' => $message,
                'errors' => ['dates' => [$message]],
            ], 422);
        }

        return null;
    }
}
