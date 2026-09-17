<?php

namespace App\Services;

use App\Enums\NotificationType;
use App\Exceptions\ReservationConflictException;
use App\Models\Reservations;
use App\Models\ReservationCancellationObligation;
use App\Models\StoreRooms;
use App\Models\Tenants;
use App\Support\CancellationRefundCalculator;
use Illuminate\Support\Facades\DB;

class ReservationService
{
    public function __construct(private ReservationPricingService $pricingService) {}

    /**
     * Extraído de ReservationsController::store: crea la reserva si no hay
     * conflicto de fechas con otra reserva confirmada. El total y el
     * subtotal de renta se calculan SIEMPRE server-side vía
     * ReservationPricingService::quote() y se persisten una sola vez; un
     * eventual total_mount enviado por el cliente en $data es IGNORADO.
     *
     * @throws ReservationConflictException si ya hay una reserva confirmada
     *                                      que se solapa con el rango solicitado.
     * @throws \App\Exceptions\ReservationPricingException si la bodega no
     *                                                      tiene un precio mensual disponible.
     */
    public function create(Tenants $tenant, StoreRooms $room, array $data, ?int $actingUserId): Reservations
    {
        $hasConflict = Reservations::where('store_room_id', $room->id)
            ->where('status', 'confirmed')
            ->whereDate('start_date', '<=', $data['end_date'])
            ->whereDate('end_date', '>=', $data['start_date'])
            ->exists();

        if ($hasConflict) {
            throw new ReservationConflictException('La bodega ya está reservada en esas fechas.');
        }

        $quote = $this->pricingService->quote($room, $data['start_date'], $data['end_date']);

        $reservation = Reservations::create([
            'store_room_id' => $room->id,
            'tenant_id' => $tenant->id,
            'start_date' => $data['start_date'],
            'end_date' => $data['end_date'],
            'status' => 'pending',
            'total_mount' => $quote['total_mount'],
            'rent_subtotal' => $quote['rent_subtotal'],
            'cancelation_reason' => null,
            // sdd/tenant-self-cancel decision #339: snapshot the room's
            // CURRENT tier now, forever, so a later landlord edit to the
            // storeroom's tier cannot change what an already-paying tenant
            // gets back on cancellation.
            'cancellation_policy_tier' => $room->cancellation_policy_tier,
            'creation_date' => now(),
        ]);

        return $reservation;
    }

    /**
     * Extraído de ReservationsController::updateStatus (rama "confirmed"):
     * confirma la reserva, notifica al tenant y al landlord dueño de la
     * bodega, y cancela en cascada cualquier otra reserva "pending" que se
     * solape en fechas con la misma bodega.
     *
     * El envío del correo de recibo (ReservationReceiptNotification) NO
     * vive aquí: se despacha desde PaymentService::process(), después de
     * que su propia llamada a DB::transaction() retorna, precisamente para
     * no extender el lockForUpdate() de StoreRooms tomado más abajo sobre
     * un round-trip SMTP. confirm() sigue teniendo un único punto de
     * llamada en producción (PaymentService::process(), rama pagada).
     *
     * Este comentario documenta la ubicación del efecto secundario, no
     * introduce ni modifica lógica en este método.
     *
     * Envuelto en una transacción que bloquea la fila de StoreRooms
     * (lockForUpdate) antes del chequeo de solapamiento contra otras
     * reservas confirmadas, para serializar confirmaciones concurrentes
     * sobre la misma bodega y cerrar la ventana de lectura fantasma que un
     * simple exists() no puede evitar. En SQLite, lockForUpdate() compila a
     * un no-op (el grammar descarta FOR UPDATE) pero la propia transacción
     * SQLite toma un lock de escritura de toda la base, más grueso pero
     * igual de correcto; no se puede ejercer concurrencia real
     * multi-conexión desde PHPUnit (proceso único) sin importar el driver,
     * así que ese aspecto queda como brecha de test aceptada y documentada,
     * no una omisión.
     *
     * @throws ReservationConflictException si ya hay OTRA reserva confirmada
     *                                      que se solapa con estas fechas.
     */
    public function confirm(Reservations $reservation, ?int $actingUserId): Reservations
    {
        return DB::transaction(function () use ($reservation, $actingUserId) {
            StoreRooms::where('id', $reservation->store_room_id)->lockForUpdate()->first();

            $hasConfirmedConflict = Reservations::where('store_room_id', $reservation->store_room_id)
                ->where('status', 'confirmed')
                ->where('id', '!=', $reservation->id)
                ->whereDate('start_date', '<=', $reservation->end_date)
                ->whereDate('end_date', '>=', $reservation->start_date)
                ->lockForUpdate()
                ->exists();

            if ($hasConfirmedConflict) {
                throw new ReservationConflictException('Ya existe una reserva confirmada en esas fechas.');
            }

            $reservation->update([
                'status' => 'confirmed',
                'cancelation_reason' => null,
            ]);

            NotificationService::send(
                $actingUserId,
                $reservation->tenants->user->id,
                NotificationType::RESERVATION_CONFIRMED,
                'Reserva confirmada',
                'Tu reserva ha sido confirmada',
                [
                    'reservation_id' => $reservation->id,
                    'store_room_id' => $reservation->store_room_id,
                ]
            );

            $reservation->load('storeRooms.landlord.user');
            $room = $reservation->storeRooms;
            if ($room && $room->landlord && $room->landlord->user) {
                NotificationService::send(
                    $actingUserId,
                    $room->landlord->user->id,
                    NotificationType::RESERVATION_BOOKED_AND_PAID,
                    'Bodega reservada y pagada',
                    'Tu bodega fue reservada y el pago quedó confirmado',
                    [
                        'reservation_id' => $reservation->id,
                        'store_room_id' => $reservation->store_room_id,
                    ]
                );
            }

            Reservations::where('store_room_id', $reservation->store_room_id)
                ->where('status', 'pending')
                ->where('id', '!=', $reservation->id)
                ->whereDate('start_date', '<=', $reservation->end_date)
                ->whereDate('end_date', '>=', $reservation->start_date)
                ->update([
                    'status' => 'canceled',
                    'cancelation_reason' => 'Blocked by confirmed reservation',
                ]);

            return $reservation->load(['storeRooms', 'tenants.user']);
        });
    }

    /**
     * HUG-06: el gestor (landlord) cancela una reserva PAGADA que aún no ha
     * empezado. Registra una obligación (reembolso al cliente + penalidad
     * del gestor), NUNCA toca el registro de payments -- lo que
     * efectivamente pasó (se pagó) sigue siendo cierto, solo cambia quién
     * debe qué a partir de ahora.
     *
     * Elegibilidad: status === 'confirmed' (única vía real hacia
     * "confirmed" es PaymentService::process() en su rama pagada, así que
     * es un proxy servidor-side confiable de "pagada") AND
     * start_date > today() (estrictamente futura; una reserva que empieza
     * HOY ya no es cancelable) AND rent_subtotal no nulo (filas anteriores
     * a esta migración no tienen snapshot de renta y no pueden liquidarse
     * correctamente).
     *
     * @throws ReservationConflictException si la reserva no es elegible.
     */
    public function cancelByLandlord(Reservations $reservation, string $reason, ?int $actingUserId): Reservations
    {
        if (! $reservation->isCancellableByLandlord()) {
            throw new ReservationConflictException(
                'Esta reserva no puede cancelarse: debe estar pagada y no haber iniciado.'
            );
        }

        return DB::transaction(function () use ($reservation, $reason, $actingUserId) {
            $reservation->load('storeRooms');
            $landlordId = $reservation->storeRooms->landlord_id;

            $reservation->update([
                'status' => 'canceled',
                'cancelation_reason' => $reason,
            ]);

            $penaltyRate = (float) config('reservations.gestor_cancellation_penalty_rate');
            $rentSubtotalCents = (int) round(((float) $reservation->rent_subtotal) * 100);
            $totalCents = (int) round(((float) $reservation->total_mount) * 100);
            $penaltyCents = (int) round($rentSubtotalCents * $penaltyRate);

            ReservationCancellationObligation::create([
                'reservation_id' => $reservation->id,
                'landlord_id' => $landlordId,
                'refund_amount' => number_format($totalCents / 100, 2, '.', ''),
                'penalty_amount' => number_format($penaltyCents / 100, 2, '.', ''),
                'penalty_rate' => $penaltyRate,
                'reason' => $reason,
                'settlement_status' => 'pending_settlement',
            ]);

            NotificationService::send(
                $actingUserId,
                $reservation->tenants->user->id,
                NotificationType::RESERVATION_CANCELED,
                'Reserva cancelada',
                $reason,
                [
                    'reservation_id' => $reservation->id,
                    'store_room_id' => $reservation->store_room_id,
                ]
            );

            return $reservation->load(['storeRooms', 'tenants.user']);
        });
    }

    /**
     * sdd/tenant-self-cancel: the tenant who owns a reservation cancels it
     * themselves. Unlike cancelByLandlord(), this path re-fetches the row
     * WITH lockForUpdate() INSIDE the transaction and re-validates
     * eligibility against that locked row (decision #339/#4 in design #342)
     * -- the $reservation instance the caller passed in is never trusted for
     * the eligibility decision, closing the TOCTOU gap the landlord path
     * deliberately leaves open. The refund is computed from the
     * reservation's SNAPSHOTTED `cancellation_policy_tier`, never the
     * storeroom's current tier.
     *
     * A `pending` (never paid) reservation is always eligible with a 0%
     * refund -- nothing was paid. A `confirmed` reservation's refund is
     * computed by CancellationRefundCalculator from the snapshot and the
     * reservation's `total_mount`.
     *
     * @throws ReservationConflictException if the locked row is no longer
     *                                       cancellable (already canceled,
     *                                       started, or start date reached).
     */
    public function cancelByTenant(Reservations $reservation, ?string $reason, ?int $actingUserId): Reservations
    {
        return DB::transaction(function () use ($reservation, $reason, $actingUserId) {
            $locked = Reservations::where('id', $reservation->id)->lockForUpdate()->firstOrFail();

            if (! $locked->isCancellableByTenant()) {
                throw new ReservationConflictException(
                    'Esta reserva no puede cancelarse: ya fue cancelada, ya inició, o no existe.'
                );
            }

            $refundAmount = $locked->status === 'confirmed'
                ? CancellationRefundCalculator::compute(
                    (string) $locked->cancellation_policy_tier,
                    (string) $locked->start_date,
                    (string) $locked->total_mount
                )
                : '0.00';

            $locked->update([
                'status' => 'canceled',
                'cancelation_reason' => $reason,
                'refund_amount' => $refundAmount,
            ]);

            $locked->load('storeRooms.landlord.user');
            $room = $locked->storeRooms;
            if ($room && $room->landlord && $room->landlord->user) {
                NotificationService::send(
                    $actingUserId,
                    $room->landlord->user->id,
                    NotificationType::RESERVATION_CANCELED,
                    'Reserva cancelada por el cliente',
                    'El cliente canceló su reserva. Revisa el reembolso correspondiente.',
                    [
                        'reservation_id' => $locked->id,
                        'store_room_id' => $locked->store_room_id,
                    ]
                );
            }

            return $locked->load(['storeRooms', 'tenants.user']);
        });
    }
}
