<?php

namespace App\Services;

use App\Models\Payments;
use App\Models\Reservations;
use Illuminate\Support\Facades\DB;

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
        return DB::transaction(function () use ($reservation, $data, $actingUserId) {
            $payment = Payments::create([
                'reservation_id' => $reservation->id,
                'payment_method' => $data['payment_method'],
                'payment_state' => $data['payment_state'],
                'payment_date' => $data['payment_date'] ?? now(),
            ]);

            if ($data['payment_state'] === 'paid' && $reservation->status !== 'confirmed') {
                $this->reservationService->confirm($reservation, $actingUserId);
            }

            return $payment;
        });
    }
}
