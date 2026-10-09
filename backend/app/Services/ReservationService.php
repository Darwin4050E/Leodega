<?php

namespace App\Services;

use App\Enums\NotificationType;
use App\Exceptions\ReservationConflictException;
use App\Models\Organization;
use App\Models\ReservationCancellationObligation;
use App\Models\Reservations;
use App\Models\StoreRooms;
use App\Models\Tenants;
use App\Notifications\ReservationCancellationNotification;
use App\Support\CancellationRefundCalculator;
use Carbon\Carbon;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\ValidationException;

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
     *                                      que se solapa con el rango solicitado,
     *                                      o si otro tenant tiene un hold
     *                                      activo (pending, no expirado) que
     *                                      se solapa (sdd/hug02-payment-hold-expiry).
     * @throws \App\Exceptions\ReservationPricingException si la bodega no
     *                                                     tiene un precio mensual disponible.
     *
     * sdd/hug02-payment-hold-expiry: wrapped in DB::transaction() with a
     * StoreRooms::lockForUpdate() room lock, mirroring confirm()'s pattern,
     * to serialize concurrent creates for the same room. Inside the lock,
     * the tenant's OWN overlapping active holds are first superseded
     * (canceled, no notification -- this is a synchronous supersede, not
     * the lazy expiry sweep, so the two can never conflate reasons or
     * double-notify). The conflict check then blocks on either a
     * `confirmed` row or ANOTHER tenant's active (non-expired) `pending`
     * hold -- a `pending` row alone no longer silently coexists.
     *
     * sdd/hue-05-reservar-organizacion (D4/D16/D17): `$organization` is the
     * caller's active org context (resolved by `org.context`, null means
     * personal). When given, its `status` MUST be `active` -- checked
     * BEFORE the transaction opens, so an inactive org never takes the room
     * lock or writes anything (OR-3). `tenant_id` always stays the creating
     * member (D4); the conflict/supersede logic right below is intentionally
     * unaware of `$organization` and keeps keying everything on `tenant_id`
     * only, so the SAME tenant's personal and org holds supersede each
     * other exactly like two personal holds would (D17, pinned by a test).
     *
     * @throws ValidationException when $organization->status !== 'active'.
     */
    public function create(Tenants $tenant, StoreRooms $room, array $data, ?int $actingUserId, ?Organization $organization = null): Reservations
    {
        if ($organization !== null && $organization->status !== 'active') {
            throw ValidationException::withMessages([
                'organization' => ['La organización seleccionada no está activa.'],
            ]);
        }

        return DB::transaction(function () use ($tenant, $room, $data, $organization) {
            StoreRooms::where('id', $room->id)->lockForUpdate()->first();

            $this->expireElapsedHolds(Reservations::where('store_room_id', $room->id));

            Reservations::where('store_room_id', $room->id)
                ->where('tenant_id', $tenant->id)
                ->activeHold()
                ->whereDate('start_date', '<=', $data['end_date'])
                ->whereDate('end_date', '>=', $data['start_date'])
                ->update([
                    'status' => 'canceled',
                    'cancelation_reason' => 'Superseded by a newer hold',
                ]);

            $hasConflict = Reservations::where('store_room_id', $room->id)
                ->where(function ($query) use ($tenant) {
                    $query->where('status', 'confirmed')
                        ->orWhere(function ($activeHoldQuery) use ($tenant) {
                            $activeHoldQuery->activeHold()->where('tenant_id', '!=', $tenant->id);
                        });
                })
                ->whereDate('start_date', '<=', $data['end_date'])
                ->whereDate('end_date', '>=', $data['start_date'])
                ->exists();

            if ($hasConflict) {
                throw new ReservationConflictException('La bodega ya está reservada en esas fechas.');
            }

            $quote = $this->pricingService->quote($room, $data['start_date'], $data['end_date']);

            return Reservations::create([
                'store_room_id' => $room->id,
                'tenant_id' => $tenant->id,
                'organization_id' => $organization?->id,
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
        });
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
     * sdd/payment-integrity (Slice C1, discovery #361): confirm() re-fetches
     * its OWN row with lockForUpdate() and re-validates that the LOCKED row's
     * status is 'pending' before writing status = 'confirmed', never trusting
     * the $reservation instance the caller passed in. Before this change,
     * confirm() had no guard on its own current status: a canceled (and
     * possibly refunded) reservation could be re-paid and resurrected. This
     * guard is pure defense-in-depth today -- confirm() has exactly ONE
     * production caller (PaymentService::process()'s paid branch), which
     * already filters out non-pending reservations via its own locked
     * three-way branch before ever calling confirm(). It does not fire on
     * the live path today; it protects any future caller.
     *
     * @throws ReservationConflictException si la fila bloqueada ya no está
     *                                      en estado 'pending' (ya
     *                                      confirmada o cancelada), o si ya
     *                                      hay OTRA reserva confirmada que
     *                                      se solapa con estas fechas.
     */
    public function confirm(Reservations $reservation, ?int $actingUserId): Reservations
    {
        return DB::transaction(function () use ($reservation, $actingUserId) {
            $locked = Reservations::where('id', $reservation->id)->lockForUpdate()->firstOrFail();

            if ($locked->status !== 'pending') {
                throw new ReservationConflictException('Esta reserva ya no está pendiente de confirmación.');
            }

            StoreRooms::where('id', $locked->store_room_id)->lockForUpdate()->first();

            $hasConfirmedConflict = Reservations::where('store_room_id', $locked->store_room_id)
                ->where('status', 'confirmed')
                ->where('id', '!=', $locked->id)
                ->whereDate('start_date', '<=', $locked->end_date)
                ->whereDate('end_date', '>=', $locked->start_date)
                ->lockForUpdate()
                ->exists();

            if ($hasConfirmedConflict) {
                throw new ReservationConflictException('Ya existe una reserva confirmada en esas fechas.');
            }

            $locked->update([
                'status' => 'confirmed',
                'cancelation_reason' => null,
            ]);

            NotificationService::send(
                $actingUserId,
                $locked->tenants->user->id,
                NotificationType::RESERVATION_CONFIRMED,
                'Reserva confirmada',
                'Tu reserva ha sido confirmada',
                [
                    'reservation_id' => $locked->id,
                    'store_room_id' => $locked->store_room_id,
                ]
            );

            $locked->load(['storeRooms.landlord.user', 'tenants.user', 'organization']);
            $room = $locked->storeRooms;
            if ($room && $room->landlord && $room->landlord->user) {
                $tenantUser = $locked->tenants->user;
                $organization = $locked->organization;
                NotificationService::send(
                    $actingUserId,
                    $room->landlord->user->id,
                    NotificationType::RESERVATION_BOOKED_AND_PAID,
                    'Bodega reservada y pagada',
                    'Tu bodega fue reservada y el pago quedó confirmado',
                    [
                        'reservation_id' => $locked->id,
                        'store_room_id' => $locked->store_room_id,
                        // HUE-05 OR-11/D5: the creator's name, never the
                        // org's -- unchanged by $organization being present.
                        'customer_name' => trim("{$tenantUser->name} {$tenantUser->lastname}"),
                        'store_room_title' => $room->title,
                        'amount' => $locked->total_mount,
                        'start_date' => $locked->start_date,
                        'end_date' => $locked->end_date,
                        'organization_name' => $organization?->name,
                        'organization_ruc' => $organization?->ruc,
                    ]
                );
            }

            Reservations::where('store_room_id', $locked->store_room_id)
                ->where('status', 'pending')
                ->where('id', '!=', $locked->id)
                ->whereDate('start_date', '<=', $locked->end_date)
                ->whereDate('end_date', '>=', $locked->start_date)
                ->update([
                    'status' => 'canceled',
                    'cancelation_reason' => 'Blocked by confirmed reservation',
                ]);

            return $locked->load(['storeRooms', 'tenants.user']);
        });
    }

    /**
     * sdd/hug02-payment-hold-expiry: lazy, idempotent transition of every
     * `pending` row matched by `$scope` whose payment hold has elapsed into
     * `canceled`/`'Expired: payment hold elapsed'`. Called from create(),
     * reservedDates(), landlordIndex(), tenantIndex(), and
     * PaymentService::process() -- there is no scheduler/cron.
     *
     * Fetches candidate rows first (eager-loading storeRooms.landlord.user
     * and tenants.user to stay N+1-free for listings), then writes each row
     * with a per-row CONDITIONAL `UPDATE ... WHERE id=? AND status='pending'`.
     * That conditional update's own row-level write lock re-checks
     * staleness at write time -- no separate `lockForUpdate()` SELECT is
     * needed. Only the request whose UPDATE actually flips the row
     * (`affected === 1`) sends the notification; a loser that raced and
     * lost (`affected === 0`) skips it. A row already canceled by
     * supersession is NEVER matched by `scopeExpiredHold()` (it filters
     * `status = 'pending'`), so it is never touched here.
     *
     * The landlord notification fires only when the elapsed time since the
     * hold's expiry instant is within `payment_hold_notify_recency_hours`
     * (default 24h) -- older stale rows are released silently, avoiding a
     * deploy-time notification burst for pre-existing stale rows.
     */
    public function expireElapsedHolds(Builder $scope): void
    {
        $rows = (clone $scope)->expiredHold()
            ->with(['storeRooms.landlord.user', 'tenants.user', 'organization'])
            ->get();

        if ($rows->isEmpty()) {
            return;
        }

        $holdMinutes = (int) config('reservations.payment_hold_minutes');
        $recencyHours = (int) config('reservations.payment_hold_notify_recency_hours');

        foreach ($rows as $row) {
            $affected = Reservations::where('id', $row->id)
                ->where('status', 'pending')
                ->update([
                    'status' => 'canceled',
                    'cancelation_reason' => 'Expired: payment hold elapsed',
                ]);

            if ($affected !== 1) {
                continue;
            }

            $expiryInstant = Carbon::parse($row->created_at)->addMinutes($holdMinutes);
            $hoursSinceExpiry = $expiryInstant->diffInHours(now());

            if ($hoursSinceExpiry > $recencyHours) {
                continue;
            }

            $room = $row->storeRooms;
            $tenantUser = $row->tenants->user ?? null;

            if (! $room || ! $room->landlord || ! $room->landlord->user || ! $tenantUser) {
                continue;
            }

            $organization = $row->organization;
            NotificationService::send(
                $tenantUser->id,
                $room->landlord->user->id,
                NotificationType::RESERVATION_EXPIRED,
                'Reserva expirada',
                'El cliente no completó el pago a tiempo; la bodega volvió a estar disponible.',
                [
                    'reservation_id' => $row->id,
                    'store_room_id' => $row->store_room_id,
                    'customer_name' => trim("{$tenantUser->name} {$tenantUser->lastname}"),
                    'store_room_title' => $room->title,
                    'start_date' => $row->start_date,
                    'end_date' => $row->end_date,
                    'organization_name' => $organization?->name,
                    'organization_ruc' => $organization?->ruc,
                ]
            );
        }
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
     * El correo al cliente (ReservationCancellationNotification) se despacha
     * DESPUÉS de que DB::transaction() retorna, nunca adentro -- mismo
     * criterio que PaymentService::process() con ReservationReceiptNotification:
     * para el momento en que se envía, la cancelación y la obligación ya
     * quedaron confirmadas en la base, así que una falla de SMTP no puede
     * revertir nada, solo se registra en el log.
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

        $reservation = DB::transaction(function () use ($reservation, $reason, $actingUserId) {
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

        try {
            $reservation->tenants->user->notify(new ReservationCancellationNotification($reservation));
        } catch (\Throwable $e) {
            Log::error('Failed to send reservation cancellation email', [
                'reservation_id' => $reservation->id,
                'error' => $e->getMessage(),
            ]);
        }

        return $reservation;
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
     *                                      cancellable (already canceled,
     *                                      started, or start date reached).
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

            $refundAmount = $this->computeRefund($locked);

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

    /**
     * sdd/tenant-reservations-screen: single source of truth for the tenant
     * refund figure, extracted verbatim from cancelByTenant()'s previously
     * inline expression (no behavior change). Called from exactly two
     * sites -- cancelByTenant() (above) and previewRefund() (below) -- so
     * the preview shown before confirmation and the amount actually
     * recorded can never drift apart (design decision #339/#1).
     */
    private function computeRefund(Reservations $reservation): string
    {
        return $reservation->status === 'confirmed'
            ? CancellationRefundCalculator::compute(
                (string) $reservation->cancellation_policy_tier,
                (string) $reservation->start_date,
                (string) $reservation->total_mount
            )
            : '0.00';
    }

    /**
     * sdd/tenant-reservations-screen: read-only preview of the refund the
     * tenant would receive if they cancelled right now. Checks the same
     * eligibility rule as cancelByTenant() and throws the identical 409 so
     * staleness surfaces at modal-open time, before the tenant commits to
     * anything (design decision #1). Never mutates the reservation.
     */
    public function previewRefund(Reservations $reservation): string
    {
        if (! $reservation->isCancellableByTenant()) {
            throw new ReservationConflictException(
                'Esta reserva no puede cancelarse: ya fue cancelada, ya inició, o no existe.'
            );
        }

        return $this->computeRefund($reservation);
    }
}
