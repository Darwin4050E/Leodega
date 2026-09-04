<?php

namespace App\Http\Controllers;

use App\Exceptions\ReservationConflictException;
use App\Exceptions\ReservationPricingException;
use App\Http\Requests\CancelReservationRequest;
use App\Http\Requests\StoreReservationRequest;
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
        } catch (ReservationPricingException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
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
            'cancellationObligation',
        ])
            ->whereHas('storeRooms', fn ($q) => $q->where('landlord_id', $landlord->id))
            ->orderByDesc('created_at')
            ->get();

        /**
         * `confirm()` is only reachable from `PaymentService::process()`'s paid
         * branch, so `status === 'confirmed'` implies payment happened. A
         * canceled reservation is only "paid" if a cancellation obligation was
         * recorded for it (HUG-06); otherwise it was auto-blocked by a
         * competing confirmed reservation before anyone paid
         * (ReservationService::create(), 'Blocked by confirmed reservation').
         */
        $items->each(function (Reservations $item) {
            $wasPaid = $item->status === 'confirmed'
                || ($item->status === 'canceled' && $item->cancellationObligation !== null);

            $item->payment_status = $wasPaid ? 'paid' : 'pending';
            $item->has_refund_obligation = $item->cancellationObligation !== null;

            /**
             * Server-computed so the cancel control can never be offered for a
             * reservation the server would reject. The client cannot derive
             * this on its own: it would have to guess what "today" is here,
             * and a viewer whose local date lags the server's would see an
             * enabled button and get a 409.
             */
            $item->can_be_cancelled = $item->isCancellableByLandlord();

            $item->makeHidden('cancellationObligation');
        });

        return response()->json($items);
    }

    /**
     * Publishes the gestor cancellation penalty rate so the frontend never
     * hardcodes a figure the backend does not agree with (HUG-06 informed
     * consent: the gestor must be shown the same rate the server will apply).
     */
    public function cancellationRate()
    {
        return response()->json([
            'gestor_cancellation_penalty_rate' => config('reservations.gestor_cancellation_penalty_rate'),
        ]);
    }

    /**
     * HUG-06: el landlord dueño de la bodega cancela una reserva pagada que
     * aún no ha empezado. Reemplaza el antiguo updateStatus() -- el ramal
     * "confirmed" murió (el pago es ahora el único camino a confirmed) y el
     * ramal "canceled" cambió de forma (paid+futura, motivo obligatorio,
     * obligación registrada) lo suficiente como para justificar un endpoint
     * con nombre propio.
     */
    public function cancel(CancelReservationRequest $request, Reservations $reservation, ReservationService $reservationService)
    {
        $data = $request->validated();

        $user = $request->user();
        $landlord = Landlords::where('user_id', $user->id)->firstOrFail();

        $reservation->load('storeRooms');

        Gate::authorize('cancel', [$reservation, $landlord]);

        try {
            $reservation = $reservationService->cancelByLandlord($reservation, $data['reason'], auth()->id());
        } catch (ReservationConflictException $e) {
            return response()->json(['message' => $e->getMessage()], 409);
        }

        return response()->json([
            'message' => 'Reserva cancelada',
            'reservation' => $reservation,
        ]);
    }

    /**
     * Corrección: findOrFail() primero para que el SoftDeletingScope global
     * de StoreRooms produzca un 404 real cuando la bodega fue eliminada (o
     * nunca existió), en vez de un array vacío silencioso.
     */
    public function reservedDates($storeRoomId)
    {
        $room = StoreRooms::findOrFail($storeRoomId);

        $ranges = Reservations::select('start_date', 'end_date')
            ->where('store_room_id', $room->id)
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
