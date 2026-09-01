<?php

namespace Tests\Feature;

use App\Models\Landlords;
use App\Models\Reservations;
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

        $response = $this->actingAs($user, 'sanctum')
            ->postJson('/api/reservations', [
                'store_room_id' => $room->id,
                'start_date' => now()->addDays(1)->toDateString(),
                'end_date' => now()->addDays(3)->toDateString(),
                'total_mount' => 150,
            ]);

        $response->assertStatus(201);

        $this->assertDatabaseHas('reservations', [
            'store_room_id' => $room->id,
            'tenant_id' => $tenant->id,
            'status' => 'pending',
        ]);
    }

    /** @test */
    public function cannot_reserve_store_room_if_dates_are_already_confirmed()
    {
        $user = User::factory()->create();
        $tenant = Tenants::factory()->create(['user_id' => $user->id]);
        $room = StoreRooms::factory()->create();

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
                'total_mount' => 200,
            ]);

        $response->assertStatus(409);
        $response->assertJson([
            'message' => 'La bodega ya está reservada en esas fechas.',
        ]);
    }

    /**
     * Fase 2: formaliza en ReservationsPolicy::updateStatus el check manual
     * que antes vivía como `if` en el controlador.
     */
    public function test_landlord_who_owns_the_store_room_can_confirm_reservation()
    {
        $landlordUser = User::factory()->create(['role' => 'landlord']);
        $landlord = Landlords::factory()->create(['user_id' => $landlordUser->id]);
        $room = StoreRooms::factory()->create(['landlord_id' => $landlord->id]);
        $reservation = Reservations::factory()->create([
            'store_room_id' => $room->id,
            'status' => 'pending',
        ]);

        $response = $this->actingAs($landlordUser, 'sanctum')
            ->patchJson("/api/landlord/reservations/{$reservation->id}/status", [
                'status' => 'confirmed',
            ]);

        $response->assertStatus(200);
        $this->assertDatabaseHas('reservations', [
            'id' => $reservation->id,
            'status' => 'confirmed',
        ]);
    }

    public function test_landlord_who_does_not_own_the_store_room_cannot_update_reservation_status()
    {
        $owner = User::factory()->create(['role' => 'landlord']);
        $ownerLandlord = Landlords::factory()->create(['user_id' => $owner->id]);
        $room = StoreRooms::factory()->create(['landlord_id' => $ownerLandlord->id]);
        $reservation = Reservations::factory()->create([
            'store_room_id' => $room->id,
            'status' => 'pending',
        ]);

        $intruder = User::factory()->create(['role' => 'landlord']);
        Landlords::factory()->create(['user_id' => $intruder->id]);

        $response = $this->actingAs($intruder, 'sanctum')
            ->patchJson("/api/landlord/reservations/{$reservation->id}/status", [
                'status' => 'confirmed',
            ]);

        $response->assertStatus(403);
        $this->assertDatabaseHas('reservations', [
            'id' => $reservation->id,
            'status' => 'pending',
        ]);
    }

    public function test_user_without_landlord_profile_gets_404_updating_reservation_status()
    {
        $user = User::factory()->create();
        $room = StoreRooms::factory()->create();
        $reservation = Reservations::factory()->create([
            'store_room_id' => $room->id,
            'status' => 'pending',
        ]);

        $response = $this->actingAs($user, 'sanctum')
            ->patchJson("/api/landlord/reservations/{$reservation->id}/status", [
                'status' => 'confirmed',
            ]);

        $response->assertStatus(404);
    }
}
