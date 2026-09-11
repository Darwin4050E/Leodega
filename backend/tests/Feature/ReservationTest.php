<?php

namespace Tests\Feature;

use App\Models\Reservations;
use App\Models\StorePrices;
use App\Models\StoreRooms;
use App\Models\Tenants;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ReservationTest extends TestCase
{
    use RefreshDatabase;

    /** @test */
    public function tenant_can_create_reservation_for_available_store_room()
    {
        $user = User::factory()->create();
        $tenant = Tenants::factory()->create(['user_id' => $user->id]);
        $room = StoreRooms::factory()->create();
        StorePrices::factory()->create([
            'store_room_id' => $room->id,
            'mode' => 'month',
            'price' => 1000,
            'disponibility' => true,
        ]);

        $response = $this->actingAs($user, 'sanctum')
            ->postJson('/api/reservations', [
                'store_room_id' => $room->id,
                'start_date' => '2026-02-01',
                'end_date' => '2026-05-01',
            ]);

        $response->assertStatus(201);

        $this->assertDatabaseHas('reservations', [
            'store_room_id' => $room->id,
            'tenant_id' => $tenant->id,
            'status' => 'pending',
            'rent_subtotal' => '3000.00',
            'total_mount' => '4180.00',
        ]);
    }

    /**
     * Per decision obs #139: a client-supplied total_mount is IGNORED, not
     * rejected. The server-computed total must win regardless.
     */
    /** @test */
    public function client_supplied_total_mount_is_ignored_and_server_computes_the_real_total()
    {
        $user = User::factory()->create();
        $tenant = Tenants::factory()->create(['user_id' => $user->id]);
        $room = StoreRooms::factory()->create();
        StorePrices::factory()->create([
            'store_room_id' => $room->id,
            'mode' => 'month',
            'price' => 1000,
            'disponibility' => true,
        ]);

        $response = $this->actingAs($user, 'sanctum')
            ->postJson('/api/reservations', [
                'store_room_id' => $room->id,
                'start_date' => '2026-02-01',
                'end_date' => '2026-05-01',
                'total_mount' => 0,
            ]);

        $response->assertStatus(201);

        $this->assertDatabaseHas('reservations', [
            'store_room_id' => $room->id,
            'tenant_id' => $tenant->id,
            'total_mount' => '4180.00',
        ]);
    }

    /** @test */
    public function cannot_reserve_store_room_if_dates_are_already_confirmed()
    {
        $user = User::factory()->create();
        $tenant = Tenants::factory()->create(['user_id' => $user->id]);
        $room = StoreRooms::factory()->create();
        StorePrices::factory()->create([
            'store_room_id' => $room->id,
            'mode' => 'month',
            'price' => 1000,
            'disponibility' => true,
        ]);

        // Reserva confirmada existente
        Reservations::factory()->create([
            'store_room_id' => $room->id,
            'start_date' => '2026-02-01',
            'end_date' => '2026-02-10',
            'status' => 'confirmed',
        ]);

        $response = $this->actingAs($user, 'sanctum')
            ->postJson('/api/reservations', [
                'store_room_id' => $room->id,
                'start_date' => '2026-02-05',
                'end_date' => '2026-02-12',
            ]);

        $response->assertStatus(409);
        $response->assertJson([
            'message' => 'La bodega ya está reservada en esas fechas.',
        ]);
    }

    /** @test */
    public function cannot_reserve_when_store_room_has_no_month_price()
    {
        $user = User::factory()->create();
        Tenants::factory()->create(['user_id' => $user->id]);
        $room = StoreRooms::factory()->create();

        $response = $this->actingAs($user, 'sanctum')
            ->postJson('/api/reservations', [
                'store_room_id' => $room->id,
                'start_date' => '2026-02-01',
                'end_date' => '2026-05-01',
            ]);

        $response->assertStatus(422);
        $this->assertDatabaseCount('reservations', 0);
    }

    /**
     * Old landlord-triggered confirm surface no longer exists: payment is
     * now the only path to `confirmed`.
     */
    /** @test */
    public function old_status_route_no_longer_exists()
    {
        $landlordUser = User::factory()->create(['role' => 'landlord']);
        $reservation = Reservations::factory()->create(['status' => 'pending']);

        $response = $this->actingAs($landlordUser, 'sanctum')
            ->patchJson("/api/landlord/reservations/{$reservation->id}/status", [
                'status' => 'confirmed',
            ]);

        $response->assertStatus(404);
    }

    /**
     * Regression guard: reservedDates() queries `reservations` by
     * store_room_id, a table StoreRooms's SoftDeletingScope never reaches.
     * The endpoint resolves the room through findOrFail() first precisely so
     * a soft-deleted storeroom yields a 404 instead of leaking the date
     * ranges of its surviving past reservations. Replacing findOrFail() with
     * a bare query would silently reintroduce that leak.
     */
    /** @test */
    public function reserved_dates_returns_404_for_a_soft_deleted_store_room()
    {
        $user = User::factory()->create();
        $room = StoreRooms::factory()->create();
        Reservations::factory()->create([
            'store_room_id' => $room->id,
            'status' => 'confirmed',
            'start_date' => today()->subDays(60)->toDateString(),
            'end_date' => today()->subDays(30)->toDateString(),
        ]);

        $this->actingAs($user, 'sanctum')
            ->getJson("/api/storeRooms/{$room->id}/reserved-dates")
            ->assertStatus(200)
            ->assertJsonCount(1);

        $room->delete();

        $this->actingAs($user, 'sanctum')
            ->getJson("/api/storeRooms/{$room->id}/reserved-dates")
            ->assertStatus(404);
    }
}
