<?php

namespace Tests\Feature;

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
