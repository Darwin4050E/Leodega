<?php

namespace App\Services;

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
     * @throws \App\Exceptions\ReservationConflictException si la reserva no
     *                                                      puede confirmarse (propagada desde ReservationService::confirm()).
     */
    public function process(Reservations $reservation, array $data, ?int $actingUserId): Payments
    {
        $reservationJustConfirmed = false;

        $payment = DB::transaction(function () use ($reservation, $data, $actingUserId, &$reservationJustConfirmed) {
            $payment = Payments::create([
                'reservation_id' => $reservation->id,
                'payment_method' => $data['payment_method'],
                'payment_state' => $data['payment_state'],
                'payment_date' => $data['payment_date'] ?? now(),
            ]);

            if ($data['payment_state'] === 'paid' && $reservation->status !== 'confirmed') {
                $this->reservationService->confirm($reservation, $actingUserId);
                $reservationJustConfirmed = true;
            }

            return $payment;
        });

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

        return $payment;
    }
}
