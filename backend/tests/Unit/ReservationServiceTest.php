<?php

namespace Tests\Unit;

use App\Exceptions\ReservationConflictException;
use App\Models\Landlords;
use App\Models\Reservations;
use App\Models\StoreRooms;
use App\Models\Tenants;
use App\Models\User;
use App\Services\ReservationService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ReservationServiceTest extends TestCase
{
    use RefreshDatabase;

    public function test_create_persists_reservation_and_notifies_landlord()
    {
        $landlordUser = User::factory()->create(['role' => 'landlord']);
        $landlord = Landlords::factory()->create(['user_id' => $landlordUser->id]);
        $room = StoreRooms::factory()->create(['landlord_id' => $landlord->id]);
        $tenant = Tenants::factory()->create();

        $reservation = (new ReservationService)->create($tenant, $room, [
            'start_date' => now()->addDay()->toDateString(),
            'end_date' => now()->addDays(3)->toDateString(),
            'total_mount' => 100,
        ], $tenant->user_id);

        $this->assertDatabaseHas('reservations', [
            'id' => $reservation->id,
            'store_room_id' => $room->id,
            'tenant_id' => $tenant->id,
            'status' => 'pending',
        ]);
        $this->assertDatabaseHas('notifications', [
            'receiver_id' => $landlordUser->id,
            'type' => 'reservation_request',
        ]);
    }

    public function test_create_throws_when_dates_overlap_a_confirmed_reservation()
    {
        $room = StoreRooms::factory()->create();
        $tenant = Tenants::factory()->create();

        Reservations::factory()->create([
            'store_room_id' => $room->id,
            'start_date' => '2026-03-01',
            'end_date' => '2026-03-10',
            'status' => 'confirmed',
        ]);

        $this->expectException(ReservationConflictException::class);

        (new ReservationService)->create($tenant, $room, [
            'start_date' => '2026-03-05',
            'end_date' => '2026-03-12',
            'total_mount' => 100,
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
        (new ReservationService)->confirm($winner, $tenantUser->id);

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

        (new ReservationService)->confirm($pending, $tenant->user_id);
    }

    public function test_cancel_updates_status_and_notifies_tenant()
    {
        $tenantUser = User::factory()->create();
        $tenant = Tenants::factory()->create(['user_id' => $tenantUser->id]);
        $reservation = Reservations::factory()->create([
            'tenant_id' => $tenant->id,
            'status' => 'pending',
        ]);
        $reservation->load('storeRooms');

        $result = (new ReservationService)->cancel($reservation, 'No disponible', $tenantUser->id);

        $this->assertSame('canceled', $result->status);
        $this->assertDatabaseHas('reservations', [
            'id' => $reservation->id,
            'status' => 'canceled',
            'cancelation_reason' => 'No disponible',
        ]);
        $this->assertDatabaseHas('notifications', [
            'receiver_id' => $tenantUser->id,
            'type' => 'reservation_canceled',
        ]);
    }
}
