<?php

namespace App\Services;

use App\Exceptions\ReservationConflictException;
use App\Models\Payments;
use App\Models\Reservations;
use App\Notifications\ReservationReceiptNotification;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

/**
 * Corrección de inconsistencia (ver PLAN_CORRECCION_INCONSISTENCIAS.md, Fase 2.2):
 * antes, PaymentsController nunca invocaba ReservationService::confirm() -- registrar
 * un pago y confirmar la reserva eran dos operaciones HTTP independientes, sin
 * transacción de servidor que las mantuviera sincronizadas.
 */
class PaymentService
{
    public function __construct(private ReservationService $reservationService) {}

    /**
     * sdd/payment-integrity (Slice C1, discovery #361, decision #363):
     * re-reads the reservation with lockForUpdate() INSIDE the transaction
     * and branches on the LOCKED row's status -- never the caller-passed,
     * possibly-stale $reservation instance -- before any write:
     *
     *   - 'canceled'  -> throws ReservationConflictException (409), no write
     *                    at all. Closes the resurrection bug: a canceled
     *                    (and possibly refunded) reservation can no longer
     *                    be re-paid and re-confirmed.
     *   - 'confirmed' -> idempotent no-op (decision #363): returns success
     *                    with the existing latest Payments row, WITHOUT
     *                    creating a second Payments row, without a second
     *                    call to confirm(), and -- structurally, because
     *                    this early return happens before the mail-dispatch
     *                    block below -- without a second receipt email.
     *   - 'pending'   -> existing behavior: creates a Payments row, and on
     *                    payment_state 'paid' calls confirm() on the locked
     *                    row.
     *
     * @return array{payment: ?Payments, status: int} 201 for the created
     *                                                 path, 200 for the
     *                                                 idempotent no-op.
     * @throws ReservationConflictException si la reserva bloqueada ya está
     *                                      cancelada, o si no puede
     *                                      confirmarse (propagada desde
     *                                      ReservationService::confirm()).
     */
    public function process(Reservations $reservation, array $data, ?int $actingUserId): array
    {
        $reservationJustConfirmed = false;
        $isNoop = false;

        $result = DB::transaction(function () use ($reservation, $data, $actingUserId, &$reservationJustConfirmed, &$isNoop) {
            $locked = Reservations::where('id', $reservation->id)->lockForUpdate()->firstOrFail();

            if ($locked->status === 'canceled') {
                throw new ReservationConflictException('Esta reserva fue cancelada y ya no admite pagos.');
            }

            if ($locked->status === 'confirmed') {
                $isNoop = true;

                return [
                    'payment' => Payments::where('reservation_id', $locked->id)->latest('id')->first(),
                    'status' => 200,
                ];
            }

            $payment = Payments::create([
                'reservation_id' => $locked->id,
                'payment_method' => $data['payment_method'],
                'payment_state' => $data['payment_state'],
                'payment_date' => $data['payment_date'] ?? now(),
            ]);

            if ($data['payment_state'] === 'paid') {
                $this->reservationService->confirm($locked, $actingUserId);
                $reservationJustConfirmed = true;
            }

            return ['payment' => $payment, 'status' => 201];
        });

        // The no-op branch returns BEFORE reaching this point -- it can
        // never trigger a second Payments row, a second confirm() call, or
        // (below) a second receipt email. This early return is the
        // structural guarantee, not a runtime check.
        if ($isNoop) {
            return $result;
        }

        /**
         * Dispatched here, AFTER DB::transaction() has returned, never
         * inside it: ReservationService::confirm() holds a
         * StoreRooms::lockForUpdate() lock for the duration of its own
         * transaction closure, and sending mail from within that scope
         * would extend the lock over an SMTP round-trip for no benefit.
         * By this point the transaction has already committed, so the
         * lock has already been released and a mail failure below cannot
         * roll back the confirmed reservation or the recorded payment.
         *
         * DB::afterCommit() is deliberately NOT used here: this repo's
         * tests run under RefreshDatabase, which wraps every test in an
         * outer transaction that is only ever rolled back, so the
         * connection's transaction level never returns to 0 and any
         * afterCommit() callback would be silently discarded under the
         * test suite (verified against vendor/laravel/framework source).
         */
        if ($reservationJustConfirmed) {
            try {
                $reservation->tenants->user->notify(new ReservationReceiptNotification($reservation));
            } catch (\Throwable $e) {
                Log::error('Failed to send reservation receipt email', [
                    'reservation_id' => $reservation->id,
                    'error' => $e->getMessage(),
                ]);
            }
        }

        return $result;
    }
}
