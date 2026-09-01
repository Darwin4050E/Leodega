<?php

namespace App\Http\Controllers;

use App\Exceptions\ReservationConflictException;
use App\Http\Requests\StoreReservationRequest;
use App\Http\Requests\UpdateReservationStatusRequest;
use App\Models\Landlords;
use App\Models\Reservations;
use App\Models\StoreRooms;
use App\Models\Tenants;
use App\Services\ReservationService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;

class ReservationsController extends Controller
{
    public function store(StoreReservationRequest $request, ReservationService $reservationService)
    {
        $data = $request->validated();

        $user = $request->user();
        $tenant = Tenants::where('user_id', $user->id)->firstOrFail();
        $room = StoreRooms::findOrFail($data['store_room_id']);

        try {
            $reservation = $reservationService->create($tenant, $room, $data, auth()->id());
        } catch (ReservationConflictException $e) {
            return response()->json(['message' => $e->getMessage()], 409);
        }

        return response()->json([
            'message' => 'Solicitud enviada',
            'reservation' => $reservation,
        ], 201);
    }

    public function landlordIndex(Request $request)
    {
        $user = $request->user();
        $landlord = Landlords::where('user_id', $user->id)->firstOrFail();

        $items = Reservations::with([
            'storeRooms:id,title,direction,city,size,room_type,landlord_id',
            'tenants.user:id,name,lastname,email,phone',
        ])
            ->whereHas('storeRooms', fn ($q) => $q->where('landlord_id', $landlord->id))
            ->orderByDesc('created_at')
            ->get();

        return response()->json($items);
    }

    public function updateStatus(UpdateReservationStatusRequest $request, Reservations $reservation, ReservationService $reservationService)
    {
        $data = $request->validated();

        $user = $request->user();
        $landlord = Landlords::where('user_id', $user->id)->firstOrFail();

        $reservation->load('storeRooms');

        Gate::authorize('updateStatus', [$reservation, $landlord]);

        if ($data['status'] === 'confirmed') {
            try {
                $reservation = $reservationService->confirm($reservation, auth()->id());
            } catch (ReservationConflictException $e) {
                return response()->json(['message' => $e->getMessage()], 409);
            }

            return response()->json([
                'message' => 'Reserva confirmada y el resto bloqueado',
                'reservation' => $reservation,
            ]);
        }

        $reservation = $reservationService->cancel($reservation, $data['cancelation_reason'] ?? null, auth()->id());

        return response()->json([
            'message' => 'Reserva cancelada',
            'reservation' => $reservation,
        ]);
    }

    public function reservedDates($storeRoomId)
    {
        $ranges = Reservations::select('start_date', 'end_date')
            ->where('store_room_id', $storeRoomId)
            ->where('status', 'confirmed')
            ->orderBy('start_date')
            ->get();

        return response()->json($ranges);
    }

    public function tenantIndex(Request $request)
    {
        $user = $request->user();
        $tenant = Tenants::where('user_id', $user->id)->firstOrFail();

        return Reservations::with('storeRooms')
            ->where('tenant_id', $tenant->id)
            ->orderBy('start_date')
            ->get();
    }
}
