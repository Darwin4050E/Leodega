<?php

namespace App\Http\Controllers;

use App\Http\Requests\CancelReservationAsTenantRequest;
use App\Http\Requests\CancelReservationRequest;
use App\Http\Requests\StoreReservationRequest;
use App\Models\Landlords;
use App\Models\Reservations;
use App\Models\StoreDisponibility;
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

        $reservation = $reservationService->create($tenant, $room, $data, auth()->id());

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
            'payments',
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

            /**
             * HUG-05 escenario 3 (comprobante de pago): the most recent
             * 'paid' Payments row for this reservation, if any. Sorted by
             * id (insertion order) rather than payment_date, which is
             * client-suppliable and not guaranteed monotonic. Null for a
             * reservation that was never actually paid (pending, or
             * auto-blocked before payment) -- the frontend uses payment_id
             * being non-null, not payment_status, to decide whether a
             * receipt exists.
             */
            $latestPaidPayment = $item->payments->sortByDesc('id')->firstWhere('payment_state', 'paid');
            $item->payment_id = $latestPaidPayment->id ?? null;
            $item->payment_method = $latestPaidPayment->payment_method ?? null;
            $item->payment_date = $latestPaidPayment->payment_date ?? null;

            $item->makeHidden(['cancellationObligation', 'payments']);
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

        $reservation = $reservationService->cancelByLandlord($reservation, $data['reason'], auth()->id());

        return response()->json([
            'message' => 'Reserva cancelada',
            'reservation' => $reservation,
        ]);
    }

    /**
     * Corrección: findOrFail() primero para que el SoftDeletingScope global
     * de StoreRooms produzca un 404 real cuando la bodega fue eliminada (o
     * nunca existió), en vez de un array vacío silencioso.
     *
     * Obs #261: unions confirmed reservations with landlord-authored
     * StoreDisponibility blocks, sorted by start_date. The response shape
     * stays byte-compatible -- a bare `[{start_date,end_date}]` array with
     * no discriminator key -- because the sole consumer
     * (services/reservations.ts::getReservedDates()) treats every range as
     * an opaque interval and must require zero changes this cycle.
     */
    public function reservedDates($storeRoomId)
    {
        $room = StoreRooms::findOrFail($storeRoomId);

        $reservationRanges = Reservations::select('start_date', 'end_date')
            ->where('store_room_id', $room->id)
            ->where('status', 'confirmed')
            ->get();

        $blockRanges = StoreDisponibility::select('start_date', 'end_date')
            ->where('store_room_id', $room->id)
            ->get();

        $ranges = $reservationRanges
            ->concat($blockRanges)
            ->sortBy('start_date')
            ->values();

        return response()->json($ranges);
    }

    /**
     * sdd/tenant-self-cancel: the tenant who owns a reservation cancels it
     * themselves. Mirrors cancel()'s shape (policy check, then delegate to
     * the service), keyed on ownership instead of landlord identity.
     */
    public function cancelAsTenant(
        CancelReservationAsTenantRequest $request,
        Reservations $reservation,
        ReservationService $reservationService
    ) {
        $data = $request->validated();

        Gate::authorize('cancelAsTenant', $reservation);

        $reservation = $reservationService->cancelByTenant($reservation, $data['reason'] ?? null, auth()->id());

        return response()->json([
            'message' => 'Reserva cancelada',
            'reservation' => $reservation,
        ]);
    }

    /**
     * sdd/tenant-reservations-screen: mirrors landlordIndex()'s ->each()
     * idiom (ReservationsController.php:57-74). can_be_cancelled is
     * server-computed for the same reason as the landlord flag -- the
     * client cannot know what "today" is on the server. photo_url applies
     * the same asset() transform as StoreRoomDetailResource::toArray()
     * (StoreRoomDetailResource.php:53) so the card never receives a bare
     * storage-relative path.
     */
    /**
     * sdd/tenant-reservations-screen: read-only refund preview, fetched by
     * the cancel modal on open. Reuses cancelAsTenant()'s exact
     * authorization gate (ReservationsPolicy::cancelAsTenant, ownership
     * only) and delegates the eligibility check and money math to
     * ReservationService::previewRefund(), which shares its private
     * computeRefund() with cancelByTenant() -- the two call sites can
     * never disagree (design decision #1).
     */
    public function cancellationPreview(Reservations $reservation, ReservationService $reservationService)
    {
        Gate::authorize('cancelAsTenant', $reservation);

        $refundAmount = $reservationService->previewRefund($reservation);

        return response()->json([
            'can_be_cancelled' => true,
            'refund_amount' => $refundAmount,
        ]);
    }

    public function tenantIndex(Request $request)
    {
        $user = $request->user();
        $tenant = Tenants::where('user_id', $user->id)->firstOrFail();

        $items = Reservations::with([
            'storeRooms:id,title,direction,city,size,room_type,landlord_id',
            'storeRooms.storePhotos',
        ])
            ->where('tenant_id', $tenant->id)
            ->orderBy('start_date')
            ->get();

        $items->each(function (Reservations $item) {
            $item->can_be_cancelled = $item->isCancellableByTenant();

            $firstPhoto = $item->storeRooms?->storePhotos->first();
            $item->photo_url = $firstPhoto ? asset('storage/'.$firstPhoto->photo_url) : null;
            $item->storeRooms?->makeHidden('storePhotos');
        });

        return response()->json($items);
    }
}
