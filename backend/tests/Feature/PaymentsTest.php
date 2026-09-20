<?php

namespace Tests\Feature;

use App\Models\Notifications;
use App\Models\Payments;
use App\Models\Reservations;
use App\Models\StoreRooms;
use App\Models\Tenants;
use App\Models\User;
use App\Notifications\ReservationReceiptNotification;
use Illuminate\Contracts\Notifications\Dispatcher;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Notification;
use Tests\TestCase;

class PaymentsTest extends TestCase
{
    use RefreshDatabase;

    /**
     * Crea una reserva junto con el User dueño real de esa reserva (el
     * tenant), para los tests que necesitan actuar como el propietario.
     */
    private function reservationWithOwner(array $attributes = []): array
    {
        $tenantUser = User::factory()->create(['role' => 'tenant']);
        $tenant = Tenants::factory()->create(['user_id' => $tenantUser->id]);
        $reservation = Reservations::factory()->create(array_merge([
            'tenant_id' => $tenant->id,
        ], $attributes));

        return [$reservation, $tenantUser];
    }

    // Fase 0.5: /api/payments ahora requiere sesión en todos sus métodos — es el
    // dato más sensible de todos (hallazgo #1 de la matriz de riesgo).
    public function test_index_requires_authentication()
    {
        $response = $this->getJson('/api/payments');

        $response->assertStatus(401);
    }

    public function test_index_returns_payments_when_authenticated()
    {
        $caller = User::factory()->create();
        Payments::factory()->count(2)->create();

        $response = $this->actingAs($caller, 'sanctum')->getJson('/api/payments');

        $response->assertStatus(200);
        $response->assertJsonCount(2);
    }

    public function test_store_requires_authentication()
    {
        $reservation = Reservations::factory()->create();

        $response = $this->postJson('/api/payments', [
            'reservation_id' => $reservation->id,
            'payment_method' => 'credit card',
            'payment_state' => 'paid',
        ]);

        $response->assertStatus(401);
    }

    public function test_store_creates_payment_when_authenticated()
    {
        [$reservation, $tenantUser] = $this->reservationWithOwner(['status' => 'pending']);

        $response = $this->actingAs($tenantUser, 'sanctum')->postJson('/api/payments', [
            'reservation_id' => $reservation->id,
            'payment_method' => 'credit card',
            'payment_state' => 'paid',
            'payment_date' => now()->toDateString(),
        ]);

        $response->assertStatus(201);
        $this->assertDatabaseHas('payments', ['reservation_id' => $reservation->id]);
    }

    public function test_store_fails_with_invalid_payment_method()
    {
        [$reservation, $tenantUser] = $this->reservationWithOwner();

        $response = $this->actingAs($tenantUser, 'sanctum')->postJson('/api/payments', [
            'reservation_id' => $reservation->id,
            'payment_method' => 'bitcoin',
            'payment_state' => 'paid',
        ]);

        $response->assertStatus(422);
        $response->assertJsonValidationErrors(['payment_method']);
    }

    /**
     * Corrección de inconsistencia (ver PLAN_CORRECCION_INCONSISTENCIAS.md,
     * Fase 2.2): antes, cualquier usuario autenticado podía registrar un
     * pago para la reserva de otro.
     */
    public function test_store_forbidden_for_a_user_who_is_not_the_reservations_tenant()
    {
        [$reservation] = $this->reservationWithOwner();
        $stranger = User::factory()->create(['role' => 'tenant']);

        $response = $this->actingAs($stranger, 'sanctum')->postJson('/api/payments', [
            'reservation_id' => $reservation->id,
            'payment_method' => 'credit card',
            'payment_state' => 'paid',
        ]);

        $response->assertStatus(403);
        $this->assertDatabaseMissing('payments', ['reservation_id' => $reservation->id]);
    }

    /**
     * Corrección de inconsistencia (ver PLAN_CORRECCION_INCONSISTENCIAS.md,
     * Fase 2.2): antes, PaymentsController nunca invocaba
     * ReservationService::confirm() -- un pago "paid" no confirmaba la
     * reserva asociada.
     */
    public function test_paid_payment_confirms_the_pending_reservation()
    {
        [$reservation, $tenantUser] = $this->reservationWithOwner(['status' => 'pending']);

        $response = $this->actingAs($tenantUser, 'sanctum')->postJson('/api/payments', [
            'reservation_id' => $reservation->id,
            'payment_method' => 'credit card',
            'payment_state' => 'paid',
        ]);

        $response->assertStatus(201);
        $this->assertDatabaseHas('reservations', [
            'id' => $reservation->id,
            'status' => 'confirmed',
        ]);
    }

    /**
     * Un pago "pending" (aún no procesado) no debe confirmar la reserva.
     */
    public function test_pending_payment_does_not_confirm_the_reservation()
    {
        [$reservation, $tenantUser] = $this->reservationWithOwner(['status' => 'pending']);

        $response = $this->actingAs($tenantUser, 'sanctum')->postJson('/api/payments', [
            'reservation_id' => $reservation->id,
            'payment_method' => 'credit card',
            'payment_state' => 'pending',
        ]);

        $response->assertStatus(201);
        $this->assertDatabaseHas('reservations', [
            'id' => $reservation->id,
            'status' => 'pending',
        ]);
    }

    /**
     * Traces to spec "Trigger — confirm-only dispatch" and "Recipient is
     * the tenant only": a paid payment that confirms the reservation must
     * email the tenant a receipt, and must never email the landlord (who
     * already gets the existing in-app RESERVATION_BOOKED_AND_PAID
     * notification).
     */
    public function test_paid_payment_sends_receipt_email_to_tenant_only()
    {
        Notification::fake();

        $landlordUser = User::factory()->create(['role' => 'landlord']);
        $room = StoreRooms::factory()->create(['landlord_id' => \App\Models\Landlords::factory()->create(['user_id' => $landlordUser->id])->id]);
        [$reservation, $tenantUser] = $this->reservationWithOwner(['status' => 'pending', 'store_room_id' => $room->id]);

        $response = $this->actingAs($tenantUser, 'sanctum')->postJson('/api/payments', [
            'reservation_id' => $reservation->id,
            'payment_method' => 'credit card',
            'payment_state' => 'paid',
        ]);

        $response->assertStatus(201);
        Notification::assertSentTo($tenantUser, ReservationReceiptNotification::class);
        Notification::assertNotSentTo($landlordUser, ReservationReceiptNotification::class);
    }

    /**
     * Traces to spec "Trigger — confirm-only dispatch": no dispatch outside
     * confirm() — a pending payment must not send the receipt email.
     */
    public function test_pending_payment_does_not_send_receipt_email()
    {
        Notification::fake();

        [$reservation, $tenantUser] = $this->reservationWithOwner(['status' => 'pending']);

        $response = $this->actingAs($tenantUser, 'sanctum')->postJson('/api/payments', [
            'reservation_id' => $reservation->id,
            'payment_method' => 'credit card',
            'payment_state' => 'pending',
        ]);

        $response->assertStatus(201);
        Notification::assertNotSentTo($tenantUser, ReservationReceiptNotification::class);
    }

    /**
     * Traces to spec "Mail failure isolation (critical)" — the single most
     * important test in this change. A throwing mail transport must not
     * roll back the confirmation, must not alter the payment, must not
     * propagate the exception to the caller, and the request must still
     * return 201.
     *
     * Mocks Illuminate\Contracts\Notifications\Dispatcher::class directly
     * (not Notification::fake(), which would swallow the exception before
     * it reaches PaymentService's try/catch) because that is the actual
     * container binding Notifiable::notify() resolves and calls send() on.
     */
    public function test_mail_failure_does_not_break_payment_confirmation()
    {
        $this->mock(Dispatcher::class, function ($mock) {
            $mock->shouldReceive('send')->andThrow(new \RuntimeException('SMTP down'));
        });

        [$reservation, $tenantUser] = $this->reservationWithOwner(['status' => 'pending']);

        $response = $this->actingAs($tenantUser, 'sanctum')->postJson('/api/payments', [
            'reservation_id' => $reservation->id,
            'payment_method' => 'credit card',
            'payment_state' => 'paid',
        ]);

        $response->assertStatus(201);
        $this->assertDatabaseHas('reservations', [
            'id' => $reservation->id,
            'status' => 'confirmed',
        ]);
        $this->assertDatabaseHas('payments', [
            'reservation_id' => $reservation->id,
            'payment_state' => 'paid',
        ]);
    }

    // -- sdd/payment-integrity (Slice C1): resurrection guard + idempotent no-op --

    /**
     * Discovery #361, resurrection via cancelByTenant() origin: cancels a
     * confirmed reservation via cancelByTenant() (recording refund_amount
     * directly on the reservation row), then attempts to re-pay it. Must be
     * rejected with 409 and leave refund_amount untouched -- distinct
     * persistence location from the cancelByLandlord() test below.
     */
    public function test_payment_on_canceled_reservation_via_cancel_by_tenant_returns_409()
    {
        [$reservation, $tenantUser] = $this->reservationWithOwner([
            'status' => 'confirmed',
            'start_date' => now()->addDays(10)->toDateString(),
            'end_date' => now()->addDays(20)->toDateString(),
            'total_mount' => 100,
            'rent_subtotal' => 80,
            'cancellation_policy_tier' => 'flexible',
        ]);

        app(\App\Services\ReservationService::class)->cancelByTenant($reservation, null, $tenantUser->id);
        $reservation->refresh();
        $refundBeforeRepay = $reservation->refund_amount;

        $response = $this->actingAs($tenantUser, 'sanctum')->postJson('/api/payments', [
            'reservation_id' => $reservation->id,
            'payment_method' => 'credit card',
            'payment_state' => 'paid',
        ]);

        $response->assertStatus(409);
        $this->assertDatabaseHas('reservations', [
            'id' => $reservation->id,
            'status' => 'canceled',
            'refund_amount' => $refundBeforeRepay,
        ]);
    }

    /**
     * Discovery #361, resurrection via cancelByLandlord() origin: cancels a
     * confirmed reservation via cancelByLandlord() (recording a SEPARATE
     * ReservationCancellationObligation row, not refund_amount on the
     * reservation), then attempts to re-pay it. Must be rejected with 409
     * and leave the obligation row unchanged -- a different table than the
     * cancelByTenant() test above, both origins must be proven independently.
     */
    public function test_payment_on_canceled_reservation_via_cancel_by_landlord_returns_409()
    {
        [$reservation, $tenantUser] = $this->reservationWithOwner([
            'status' => 'confirmed',
            'start_date' => now()->addDays(5)->toDateString(),
            'end_date' => now()->addDays(35)->toDateString(),
            'rent_subtotal' => 3000,
            'total_mount' => 4000,
        ]);
        $landlordUser = User::factory()->create(['role' => 'landlord']);

        app(\App\Services\ReservationService::class)->cancelByLandlord($reservation, 'Motivo de prueba', $landlordUser->id);
        $obligationBeforeRepay = \App\Models\ReservationCancellationObligation::where('reservation_id', $reservation->id)->firstOrFail();

        $response = $this->actingAs($tenantUser, 'sanctum')->postJson('/api/payments', [
            'reservation_id' => $reservation->id,
            'payment_method' => 'credit card',
            'payment_state' => 'paid',
        ]);

        $response->assertStatus(409);
        $this->assertDatabaseHas('reservations', ['id' => $reservation->id, 'status' => 'canceled']);
        $this->assertDatabaseCount('reservation_cancellation_obligations', 1);
        $this->assertDatabaseHas('reservation_cancellation_obligations', [
            'id' => $obligationBeforeRepay->id,
            'reservation_id' => $reservation->id,
            'refund_amount' => $obligationBeforeRepay->refund_amount,
            'penalty_amount' => $obligationBeforeRepay->penalty_amount,
        ]);
    }

    /**
     * Decision #363: confirmed -> confirmed is a provably side-effect-free
     * idempotent no-op, not a 409. A 200 alone is explicitly NOT sufficient
     * evidence -- this test arms Notification::fake() across BOTH requests
     * and asserts the payments row count is unchanged and the receipt mail
     * was dispatched exactly ONCE total across both calls.
     */
    public function test_second_payment_on_confirmed_reservation_is_a_provable_noop()
    {
        Notification::fake();

        [$reservation, $tenantUser] = $this->reservationWithOwner(['status' => 'pending']);

        $first = $this->actingAs($tenantUser, 'sanctum')->postJson('/api/payments', [
            'reservation_id' => $reservation->id,
            'payment_method' => 'credit card',
            'payment_state' => 'paid',
        ]);
        $first->assertStatus(201);

        $paymentsAfterFirst = Payments::where('reservation_id', $reservation->id)->count();
        $notificationsAfterFirst = Notifications::where('receiver_id', $tenantUser->id)->count();

        $second = $this->actingAs($tenantUser, 'sanctum')->postJson('/api/payments', [
            'reservation_id' => $reservation->id,
            'payment_method' => 'credit card',
            'payment_state' => 'paid',
        ]);

        $second->assertSuccessful();
        $this->assertSame(
            $paymentsAfterFirst,
            Payments::where('reservation_id', $reservation->id)->count(),
            'The no-op branch must not create a second Payments row.'
        );
        Notification::assertSentTo($tenantUser, ReservationReceiptNotification::class, 1);
        $this->assertSame(
            $notificationsAfterFirst,
            Notifications::where('receiver_id', $tenantUser->id)->count(),
            'The no-op branch must not create a second in-app Notifications row.'
        );
    }

    /**
     * Spec requirement "duplicate payment attempts on a pending reservation
     * are serialized": process() must re-read and re-validate the
     * reservation's status inside the locked transaction, not rely on the
     * in-memory, unlocked $reservation->status. Proves what CAN be proven in
     * a single-process PHPUnit suite (locked re-read), not a real
     * multi-connection race.
     */
    public function test_process_re_reads_locked_reservation_status_not_the_stale_instance()
    {
        [$reservation, $tenantUser] = $this->reservationWithOwner(['status' => 'pending']);

        // A concurrent operation wins the race and confirms the row first,
        // bypassing the in-memory $reservation instance.
        Reservations::where('id', $reservation->id)->update(['status' => 'confirmed']);

        $paymentsBefore = Payments::where('reservation_id', $reservation->id)->count();

        $response = $this->actingAs($tenantUser, 'sanctum')->postJson('/api/payments', [
            'reservation_id' => $reservation->id,
            'payment_method' => 'credit card',
            'payment_state' => 'paid',
        ]);

        // The locked re-read observes 'confirmed', not the stale 'pending'
        // instance -- so this must follow the no-op path, not create a
        // second Payments row.
        $response->assertSuccessful();
        $this->assertSame(
            $paymentsBefore,
            Payments::where('reservation_id', $reservation->id)->count(),
            'The locked re-read must see the real (confirmed) status, not the stale pending instance.'
        );
    }

    /**
     * Sequential double-submit against a pending reservation (two full HTTP
     * POSTs, no real concurrency): the first confirms; the second must
     * follow the confirmed -> confirmed no-op path, not duplicate the write.
     */
    public function test_sequential_double_submit_on_pending_reservation_confirms_once()
    {
        Notification::fake();

        [$reservation, $tenantUser] = $this->reservationWithOwner(['status' => 'pending']);

        $first = $this->actingAs($tenantUser, 'sanctum')->postJson('/api/payments', [
            'reservation_id' => $reservation->id,
            'payment_method' => 'credit card',
            'payment_state' => 'paid',
        ]);
        $first->assertStatus(201);

        $second = $this->actingAs($tenantUser, 'sanctum')->postJson('/api/payments', [
            'reservation_id' => $reservation->id,
            'payment_method' => 'credit card',
            'payment_state' => 'paid',
        ]);
        $second->assertSuccessful();

        $this->assertSame(1, Payments::where('reservation_id', $reservation->id)->count());
        $this->assertDatabaseHas('reservations', ['id' => $reservation->id, 'status' => 'confirmed']);
        Notification::assertSentTo($tenantUser, ReservationReceiptNotification::class, 1);
    }

    /**
     * Proves the change does not over-restrict legitimate multi-row payment
     * history: Reservations::payments() stays an unconstrained hasMany. A
     * retry after a genuinely FAILED payment attempt (reservation stays
     * pending) must still create a new Payments row and confirm on the
     * paid retry.
     */
    public function test_retry_after_failed_payment_still_creates_a_new_row()
    {
        [$reservation, $tenantUser] = $this->reservationWithOwner(['status' => 'pending']);

        $failed = $this->actingAs($tenantUser, 'sanctum')->postJson('/api/payments', [
            'reservation_id' => $reservation->id,
            'payment_method' => 'credit card',
            'payment_state' => 'failed',
        ]);
        $failed->assertStatus(201);
        $this->assertDatabaseHas('reservations', ['id' => $reservation->id, 'status' => 'pending']);

        $retry = $this->actingAs($tenantUser, 'sanctum')->postJson('/api/payments', [
            'reservation_id' => $reservation->id,
            'payment_method' => 'credit card',
            'payment_state' => 'paid',
        ]);

        $retry->assertStatus(201);
        $this->assertSame(2, Payments::where('reservation_id', $reservation->id)->count());
        $this->assertDatabaseHas('reservations', ['id' => $reservation->id, 'status' => 'confirmed']);
    }

    /**
     * Spec requirement "ownership enforcement is unaffected by the new
     * guard": PaymentsPolicy::create() (ownership check) must run BEFORE
     * the status-transition branch on every path -- no 409/200 leaking
     * through for a non-owner on any reservation status.
     */
    public function test_payment_on_non_owner_reservation_returns_403_regardless_of_status()
    {
        foreach (['pending', 'confirmed', 'canceled'] as $status) {
            [$reservation] = $this->reservationWithOwner(['status' => $status]);
            $stranger = User::factory()->create(['role' => 'tenant']);

            $response = $this->actingAs($stranger, 'sanctum')->postJson('/api/payments', [
                'reservation_id' => $reservation->id,
                'payment_method' => 'credit card',
                'payment_state' => 'paid',
            ]);

            $response->assertStatus(403);
            $this->assertDatabaseMissing('payments', ['reservation_id' => $reservation->id]);
        }
    }

    public function test_destroy_requires_authentication()
    {
        $payment = Payments::factory()->create();

        $response = $this->deleteJson("/api/payments/{$payment->id}");

        $response->assertStatus(401);
    }

    public function test_destroy_deletes_payment_when_authenticated()
    {
        $caller = User::factory()->create();
        $payment = Payments::factory()->create();

        $response = $this->actingAs($caller, 'sanctum')->deleteJson("/api/payments/{$payment->id}");

        $response->assertStatus(200);
        $this->assertDatabaseMissing('payments', ['id' => $payment->id]);
    }
}
