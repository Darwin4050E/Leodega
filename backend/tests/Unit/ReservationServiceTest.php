<?php

namespace Tests\Unit;

use App\Exceptions\ReservationConflictException;
use App\Models\Landlords;
use App\Models\ReservationCancellationObligation;
use App\Models\Reservations;
use App\Models\StorePrices;
use App\Models\StoreRooms;
use App\Models\Tenants;
use App\Models\User;
use App\Services\ReservationPricingService;
use App\Services\ReservationService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ReservationServiceTest extends TestCase
{
    use RefreshDatabase;

    private function service(): ReservationService
    {
        return new ReservationService(new ReservationPricingService);
    }

    private function monthPriceFor(StoreRooms $room, int $price = 1000): void
    {
        StorePrices::factory()->create([
            'store_room_id' => $room->id,
            'mode' => 'month',
            'price' => $price,
            'disponibility' => true,
        ]);
    }

    public function test_create_persists_reservation_with_server_computed_total()
    {
        $landlordUser = User::factory()->create(['role' => 'landlord']);
        $landlord = Landlords::factory()->create(['user_id' => $landlordUser->id]);
        $room = StoreRooms::factory()->create(['landlord_id' => $landlord->id]);
        $this->monthPriceFor($room);
        $tenant = Tenants::factory()->create();

        $reservation = $this->service()->create($tenant, $room, [
            'start_date' => '2026-02-01',
            'end_date' => '2026-05-01',
        ], $tenant->user_id);

        $this->assertDatabaseHas('reservations', [
            'id' => $reservation->id,
            'store_room_id' => $room->id,
            'tenant_id' => $tenant->id,
            'status' => 'pending',
            'rent_subtotal' => '3000.00',
            'total_mount' => '4180.00',
        ]);
    }

    /**
     * create() no longer dispatches a create-time landlord notification:
     * nothing meaningful to tell before payment happens under instant-book.
     */
    public function test_create_does_not_notify_the_landlord()
    {
        $landlordUser = User::factory()->create(['role' => 'landlord']);
        $landlord = Landlords::factory()->create(['user_id' => $landlordUser->id]);
        $room = StoreRooms::factory()->create(['landlord_id' => $landlord->id]);
        $this->monthPriceFor($room);
        $tenant = Tenants::factory()->create();

        $this->service()->create($tenant, $room, [
            'start_date' => '2026-02-01',
            'end_date' => '2026-05-01',
        ], $tenant->user_id);

        $this->assertDatabaseCount('notifications', 0);
    }

    public function test_create_throws_when_dates_overlap_a_confirmed_reservation()
    {
        $room = StoreRooms::factory()->create();
        $this->monthPriceFor($room);
        $tenant = Tenants::factory()->create();

        Reservations::factory()->create([
            'store_room_id' => $room->id,
            'start_date' => '2026-03-01',
            'end_date' => '2026-03-10',
            'status' => 'confirmed',
        ]);

        $this->expectException(ReservationConflictException::class);

        $this->service()->create($tenant, $room, [
            'start_date' => '2026-03-05',
            'end_date' => '2026-03-12',
        ], $tenant->user_id);
    }

    /**
     * Esta es la lógica más importante y menos obvia de todo el módulo:
     * confirmar una reserva cancela en cascada cualquier OTRA reserva
     * "pending" de la misma bodega que se solape en fechas. No tenía ningún
     * test que la cubriera antes de esta extracción.
     */
    public function test_confirm_cascades_cancellation_to_overlapping_pending_reservations()
    {
        $tenantUser = User::factory()->create();
        $tenant = Tenants::factory()->create(['user_id' => $tenantUser->id]);
        $room = StoreRooms::factory()->create();

        $winner = Reservations::factory()->create([
            'store_room_id' => $room->id,
            'tenant_id' => $tenant->id,
            'start_date' => '2026-04-01',
            'end_date' => '2026-04-10',
            'status' => 'pending',
        ]);

        $overlapping = Reservations::factory()->create([
            'store_room_id' => $room->id,
            'tenant_id' => $tenant->id,
            'start_date' => '2026-04-05',
            'end_date' => '2026-04-15',
            'status' => 'pending',
        ]);

        $nonOverlapping = Reservations::factory()->create([
            'store_room_id' => $room->id,
            'tenant_id' => $tenant->id,
            'start_date' => '2026-05-01',
            'end_date' => '2026-05-10',
            'status' => 'pending',
        ]);

        $winner->load('storeRooms');
        $this->service()->confirm($winner, $tenantUser->id);

        $this->assertDatabaseHas('reservations', ['id' => $winner->id, 'status' => 'confirmed']);
        $this->assertDatabaseHas('reservations', [
            'id' => $overlapping->id,
            'status' => 'canceled',
            'cancelation_reason' => 'Blocked by confirmed reservation',
        ]);
        $this->assertDatabaseHas('reservations', ['id' => $nonOverlapping->id, 'status' => 'pending']);
        $this->assertDatabaseHas('notifications', [
            'receiver_id' => $tenantUser->id,
            'type' => 'reservation_confirmed',
        ]);
    }

    public function test_confirm_notifies_the_owning_landlord_of_the_paid_booking()
    {
        $tenantUser = User::factory()->create();
        $tenant = Tenants::factory()->create(['user_id' => $tenantUser->id]);
        $landlordUser = User::factory()->create(['role' => 'landlord']);
        $landlord = Landlords::factory()->create(['user_id' => $landlordUser->id]);
        $room = StoreRooms::factory()->create(['landlord_id' => $landlord->id]);

        $reservation = Reservations::factory()->create([
            'store_room_id' => $room->id,
            'tenant_id' => $tenant->id,
            'status' => 'pending',
        ]);
        $reservation->load('storeRooms');

        $this->service()->confirm($reservation, $tenantUser->id);

        $this->assertDatabaseHas('notifications', [
            'receiver_id' => $landlordUser->id,
            'type' => 'reservation_booked_and_paid',
        ]);
    }

    public function test_confirm_throws_when_another_confirmed_reservation_overlaps()
    {
        $tenant = Tenants::factory()->create();
        $room = StoreRooms::factory()->create();

        Reservations::factory()->create([
            'store_room_id' => $room->id,
            'start_date' => '2026-06-01',
            'end_date' => '2026-06-10',
            'status' => 'confirmed',
        ]);

        $pending = Reservations::factory()->create([
            'store_room_id' => $room->id,
            'tenant_id' => $tenant->id,
            'start_date' => '2026-06-05',
            'end_date' => '2026-06-12',
            'status' => 'pending',
        ]);
        $pending->load('storeRooms');

        $this->expectException(ReservationConflictException::class);

        $this->service()->confirm($pending, $tenant->user_id);
    }

    public function test_cancel_by_landlord_creates_obligation_and_notifies_tenant_leaving_payment_untouched()
    {
        $tenantUser = User::factory()->create();
        $tenant = Tenants::factory()->create(['user_id' => $tenantUser->id]);
        $landlordUser = User::factory()->create(['role' => 'landlord']);
        $landlord = Landlords::factory()->create(['user_id' => $landlordUser->id]);
        $room = StoreRooms::factory()->create(['landlord_id' => $landlord->id]);

        $reservation = Reservations::factory()->create([
            'store_room_id' => $room->id,
            'tenant_id' => $tenant->id,
            'status' => 'confirmed',
            'start_date' => now()->addDays(5)->toDateString(),
            'end_date' => now()->addDays(35)->toDateString(),
            'rent_subtotal' => 3000,
            'total_mount' => 4180,
        ]);

        \App\Models\Payments::factory()->create([
            'reservation_id' => $reservation->id,
            'payment_state' => 'paid',
        ]);

        $result = $this->service()->cancelByLandlord($reservation, 'El almacen sufrio un incendio', $landlordUser->id);

        $this->assertSame('canceled', $result->status);
        $this->assertDatabaseHas('reservations', [
            'id' => $reservation->id,
            'status' => 'canceled',
        ]);
        $this->assertDatabaseHas('reservation_cancellation_obligations', [
            'reservation_id' => $reservation->id,
            'landlord_id' => $landlord->id,
            'refund_amount' => '4180.00',
            'penalty_amount' => '450.00',
            'penalty_rate' => '0.1500',
            'settlement_status' => 'pending_settlement',
        ]);
        $this->assertDatabaseHas('payments', [
            'reservation_id' => $reservation->id,
            'payment_state' => 'paid',
        ]);
        $this->assertDatabaseHas('notifications', [
            'receiver_id' => $tenantUser->id,
            'type' => 'reservation_canceled',
        ]);
    }

    /**
     * The obligation must still resolve its debtor landlord even after the
     * storeroom is soft-deleted (decision obs #141): landlord_id is
     * snapshotted on the obligation row, not resolved live through
     * reservation.storeRooms.landlord_id.
     */
    public function test_cancel_by_landlord_obligation_survives_storeroom_soft_delete()
    {
        $landlordUser = User::factory()->create(['role' => 'landlord']);
        $landlord = Landlords::factory()->create(['user_id' => $landlordUser->id]);
        $room = StoreRooms::factory()->create(['landlord_id' => $landlord->id]);
        $tenant = Tenants::factory()->create();

        $reservation = Reservations::factory()->create([
            'store_room_id' => $room->id,
            'tenant_id' => $tenant->id,
            'status' => 'confirmed',
            'start_date' => now()->addDays(5)->toDateString(),
            'end_date' => now()->addDays(35)->toDateString(),
            'rent_subtotal' => 3000,
            'total_mount' => 4180,
        ]);

        $this->service()->cancelByLandlord($reservation, 'El almacen sufrio un incendio', $landlordUser->id);

        // Now the reservation is canceled (does not block deletion), so the
        // gestor can soft-delete the storeroom.
        $room->delete();

        $obligation = ReservationCancellationObligation::where('reservation_id', $reservation->id)->firstOrFail();

        $this->assertNull($reservation->fresh()->storeRooms);
        $this->assertNotNull($obligation->landlord);
        $this->assertSame($landlord->id, $obligation->landlord->id);
    }

    public function test_cancel_by_landlord_rejects_reservation_starting_today()
    {
        $room = StoreRooms::factory()->create();
        $tenant = Tenants::factory()->create();

        $reservation = Reservations::factory()->create([
            'store_room_id' => $room->id,
            'tenant_id' => $tenant->id,
            'status' => 'confirmed',
            'start_date' => today()->toDateString(),
            'end_date' => today()->addDays(30)->toDateString(),
            'rent_subtotal' => 3000,
            'total_mount' => 4180,
        ]);

        try {
            $this->service()->cancelByLandlord($reservation, 'El almacen sufrio un incendio', $tenant->user_id);
            $this->fail('Expected ReservationConflictException');
        } catch (ReservationConflictException $e) {
            $this->assertDatabaseCount('reservation_cancellation_obligations', 0);
        }
    }

    public function test_cancel_by_landlord_rejects_reservation_already_started()
    {
        $room = StoreRooms::factory()->create();
        $tenant = Tenants::factory()->create();

        $reservation = Reservations::factory()->create([
            'store_room_id' => $room->id,
            'tenant_id' => $tenant->id,
            'status' => 'confirmed',
            'start_date' => today()->subDays(2)->toDateString(),
            'end_date' => today()->addDays(30)->toDateString(),
            'rent_subtotal' => 3000,
            'total_mount' => 4180,
        ]);

        try {
            $this->service()->cancelByLandlord($reservation, 'El almacen sufrio un incendio', $tenant->user_id);
            $this->fail('Expected ReservationConflictException');
        } catch (ReservationConflictException $e) {
            $this->assertDatabaseCount('reservation_cancellation_obligations', 0);
        }
    }

    public function test_cancel_by_landlord_rejects_unpaid_pending_reservation()
    {
        $room = StoreRooms::factory()->create();
        $tenant = Tenants::factory()->create();

        $reservation = Reservations::factory()->create([
            'store_room_id' => $room->id,
            'tenant_id' => $tenant->id,
            'status' => 'pending',
            'start_date' => now()->addDays(5)->toDateString(),
            'end_date' => now()->addDays(35)->toDateString(),
            'rent_subtotal' => 3000,
            'total_mount' => 4180,
        ]);

        try {
            $this->service()->cancelByLandlord($reservation, 'El almacen sufrio un incendio', $tenant->user_id);
            $this->fail('Expected ReservationConflictException');
        } catch (ReservationConflictException $e) {
            $this->assertDatabaseCount('reservation_cancellation_obligations', 0);
        }
    }

    public function test_cancel_by_landlord_rejects_already_canceled_reservation()
    {
        $room = StoreRooms::factory()->create();
        $tenant = Tenants::factory()->create();

        $reservation = Reservations::factory()->create([
            'store_room_id' => $room->id,
            'tenant_id' => $tenant->id,
            'status' => 'canceled',
            'start_date' => now()->addDays(5)->toDateString(),
            'end_date' => now()->addDays(35)->toDateString(),
            'rent_subtotal' => 3000,
            'total_mount' => 4180,
        ]);

        try {
            $this->service()->cancelByLandlord($reservation, 'El almacen sufrio un incendio', $tenant->user_id);
            $this->fail('Expected ReservationConflictException');
        } catch (ReservationConflictException $e) {
            $this->assertDatabaseCount('reservation_cancellation_obligations', 0);
        }
    }

    public function test_cancel_by_landlord_rejects_reservation_with_no_rent_subtotal_snapshot()
    {
        $room = StoreRooms::factory()->create();
        $tenant = Tenants::factory()->create();

        $reservation = Reservations::factory()->create([
            'store_room_id' => $room->id,
            'tenant_id' => $tenant->id,
            'status' => 'confirmed',
            'start_date' => now()->addDays(5)->toDateString(),
            'end_date' => now()->addDays(35)->toDateString(),
            'rent_subtotal' => null,
            'total_mount' => 4180,
        ]);

        try {
            $this->service()->cancelByLandlord($reservation, 'El almacen sufrio un incendio', $tenant->user_id);
            $this->fail('Expected ReservationConflictException');
        } catch (ReservationConflictException $e) {
            $this->assertDatabaseCount('reservation_cancellation_obligations', 0);
        }
    }
}
