<?php

namespace Tests\Feature;

use App\Models\Landlords;
use App\Models\ReservationCancellationObligation;
use App\Models\Reservations;
use App\Models\StoreRooms;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class LandlordReservationIndexTest extends TestCase
{
    use RefreshDatabase;

    private function landlord(): array
    {
        $user = User::factory()->create(['role' => 'landlord']);
        $landlord = Landlords::factory()->create(['user_id' => $user->id]);

        return [$user, $landlord];
    }

    public function test_cancellation_rate_endpoint_returns_configured_value()
    {
        [$user] = $this->landlord();

        config(['reservations.gestor_cancellation_penalty_rate' => 0.15]);

        $response = $this->actingAs($user, 'sanctum')
            ->getJson('/api/landlord/reservations/cancellation-rate');

        $response->assertStatus(200)
            ->assertJson(['gestor_cancellation_penalty_rate' => 0.15]);
    }

    public function test_confirmed_reservation_is_reported_as_paid_with_no_obligation()
    {
        [$user, $landlord] = $this->landlord();
        $room = StoreRooms::factory()->create(['landlord_id' => $landlord->id]);
        $reservation = Reservations::factory()->create([
            'store_room_id' => $room->id,
            'status' => 'confirmed',
            'rent_subtotal' => 3000,
            'total_mount' => 4180,
        ]);

        $response = $this->actingAs($user, 'sanctum')
            ->getJson('/api/landlord/reservations');

        $response->assertStatus(200);
        $item = collect($response->json())->firstWhere('id', $reservation->id);
        $this->assertSame('paid', $item['payment_status']);
        $this->assertFalse($item['has_refund_obligation']);
    }

    public function test_pending_reservation_is_reported_as_pending_with_no_obligation()
    {
        [$user, $landlord] = $this->landlord();
        $room = StoreRooms::factory()->create(['landlord_id' => $landlord->id]);
        $reservation = Reservations::factory()->create([
            'store_room_id' => $room->id,
            'status' => 'pending',
            'rent_subtotal' => 3000,
            'total_mount' => 4180,
        ]);

        $response = $this->actingAs($user, 'sanctum')
            ->getJson('/api/landlord/reservations');

        $item = collect($response->json())->firstWhere('id', $reservation->id);
        $this->assertSame('pending', $item['payment_status']);
        $this->assertFalse($item['has_refund_obligation']);
    }

    /**
     * Canceled WITH a recorded obligation means a gestor cancelled a paid
     * reservation (HUG-06) -- a refund is owed. Must be reported as paid
     * plus has_refund_obligation, so the frontend renders REEMBOLSADO, not
     * "Sin cobro".
     */
    public function test_canceled_reservation_with_obligation_is_reported_as_paid_with_refund_obligation()
    {
        [$user, $landlord] = $this->landlord();
        $room = StoreRooms::factory()->create(['landlord_id' => $landlord->id]);
        $reservation = Reservations::factory()->create([
            'store_room_id' => $room->id,
            'status' => 'canceled',
            'rent_subtotal' => 3000,
            'total_mount' => 4180,
        ]);
        ReservationCancellationObligation::factory()->create([
            'reservation_id' => $reservation->id,
            'landlord_id' => $landlord->id,
            'refund_amount' => 4180,
            'penalty_amount' => 450,
            'penalty_rate' => 0.15,
            'reason' => 'El almacen sufrio un incendio',
        ]);

        $response = $this->actingAs($user, 'sanctum')
            ->getJson('/api/landlord/reservations');

        $item = collect($response->json())->firstWhere('id', $reservation->id);
        $this->assertSame('paid', $item['payment_status']);
        $this->assertTrue($item['has_refund_obligation']);
    }

    /**
     * Canceled WITHOUT an obligation means the reservation was auto-blocked
     * by a competing confirmed reservation (ReservationService::create(),
     * 'Blocked by confirmed reservation') and was never paid. The frontend
     * must render "Sin cobro", never REEMBOLSADO or PENDIENTE.
     */
    public function test_canceled_reservation_without_obligation_is_reported_as_never_paid()
    {
        [$user, $landlord] = $this->landlord();
        $room = StoreRooms::factory()->create(['landlord_id' => $landlord->id]);
        $reservation = Reservations::factory()->create([
            'store_room_id' => $room->id,
            'status' => 'canceled',
            'rent_subtotal' => null,
            'total_mount' => 0,
            'cancelation_reason' => 'Blocked by confirmed reservation',
        ]);

        $response = $this->actingAs($user, 'sanctum')
            ->getJson('/api/landlord/reservations');

        $item = collect($response->json())->firstWhere('id', $reservation->id);
        $this->assertSame('pending', $item['payment_status']);
        $this->assertFalse($item['has_refund_obligation']);
    }

    /**
     * `can_be_cancelled` is computed server-side from the SAME rule the cancel
     * guard enforces (Reservations::isCancellableByLandlord). The client must
     * not derive it: it would have to guess what "today" is on the server, and
     * a viewer whose local date lags the server's would be shown an enabled
     * button that then fails with 409.
     */
    public function test_can_be_cancelled_is_true_only_for_a_paid_strictly_future_reservation()
    {
        [$user, $landlord] = $this->landlord();
        $room = StoreRooms::factory()->create(['landlord_id' => $landlord->id]);

        $eligible = Reservations::factory()->create([
            'store_room_id' => $room->id,
            'status' => 'confirmed',
            'rent_subtotal' => 3000,
            'total_mount' => 4180,
            'start_date' => today()->addDays(5)->toDateString(),
            'end_date' => today()->addDays(35)->toDateString(),
        ]);

        // Starts today: "Activa", never cancellable — the strict-future boundary.
        $startsToday = Reservations::factory()->create([
            'store_room_id' => $room->id,
            'status' => 'confirmed',
            'rent_subtotal' => 3000,
            'total_mount' => 4180,
            'start_date' => today()->toDateString(),
            'end_date' => today()->addDays(30)->toDateString(),
        ]);

        // Future but unpaid.
        $unpaid = Reservations::factory()->create([
            'store_room_id' => $room->id,
            'status' => 'pending',
            'rent_subtotal' => 3000,
            'total_mount' => 4180,
            'start_date' => today()->addDays(5)->toDateString(),
            'end_date' => today()->addDays(35)->toDateString(),
        ]);

        $items = collect(
            $this->actingAs($user, 'sanctum')->getJson('/api/landlord/reservations')->json()
        );

        $this->assertTrue($items->firstWhere('id', $eligible->id)['can_be_cancelled']);
        $this->assertFalse($items->firstWhere('id', $startsToday->id)['can_be_cancelled']);
        $this->assertFalse($items->firstWhere('id', $unpaid->id)['can_be_cancelled']);
    }

    /**
     * Guards the single-definition rule: whatever `can_be_cancelled` reports,
     * the cancel endpoint must agree. If these ever diverge, the UI starts
     * offering an action the server rejects.
     */
    public function test_can_be_cancelled_agrees_with_what_the_cancel_endpoint_accepts()
    {
        [$user, $landlord] = $this->landlord();
        $room = StoreRooms::factory()->create(['landlord_id' => $landlord->id]);
        $reservation = Reservations::factory()->create([
            'store_room_id' => $room->id,
            'status' => 'confirmed',
            'rent_subtotal' => 3000,
            'total_mount' => 4180,
            'start_date' => today()->toDateString(),
            'end_date' => today()->addDays(30)->toDateString(),
        ]);

        $item = collect(
            $this->actingAs($user, 'sanctum')->getJson('/api/landlord/reservations')->json()
        )->firstWhere('id', $reservation->id);

        $this->assertFalse($item['can_be_cancelled']);

        $this->actingAs($user, 'sanctum')
            ->patchJson("/api/landlord/reservations/{$reservation->id}/cancel", [
                'reason' => 'El almacen sufrio un incendio',
            ])
            ->assertStatus(409);
    }
}
