<?php

namespace Tests\Feature;

use App\Models\Landlords;
use App\Models\Reservations;
use App\Models\StoreRooms;
use App\Models\Tenants;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ReservationCancellationTest extends TestCase
{
    use RefreshDatabase;

    private function eligibleReservation(Landlords $landlord): Reservations
    {
        $room = StoreRooms::factory()->create(['landlord_id' => $landlord->id]);

        return Reservations::factory()->create([
            'store_room_id' => $room->id,
            'status' => 'confirmed',
            'start_date' => now()->addDays(5)->toDateString(),
            'end_date' => now()->addDays(35)->toDateString(),
            'rent_subtotal' => 3000,
            'total_mount' => 4180,
        ]);
    }

    public function test_owning_landlord_can_cancel_an_eligible_reservation()
    {
        $landlordUser = User::factory()->create(['role' => 'landlord']);
        $landlord = Landlords::factory()->create(['user_id' => $landlordUser->id]);
        $reservation = $this->eligibleReservation($landlord);

        $response = $this->actingAs($landlordUser, 'sanctum')
            ->patchJson("/api/landlord/reservations/{$reservation->id}/cancel", [
                'reason' => 'El almacen sufrio un incendio',
            ]);

        $response->assertStatus(200);
        $this->assertDatabaseHas('reservations', [
            'id' => $reservation->id,
            'status' => 'canceled',
        ]);
        $this->assertDatabaseHas('reservation_cancellation_obligations', [
            'reservation_id' => $reservation->id,
            'landlord_id' => $landlord->id,
            'refund_amount' => '4180.00',
            'penalty_amount' => '450.00',
        ]);
        $this->assertDatabaseHas('notifications', [
            'type' => 'reservation_canceled',
        ]);
    }

    public function test_cannot_cancel_a_reservation_starting_today()
    {
        $landlordUser = User::factory()->create(['role' => 'landlord']);
        $landlord = Landlords::factory()->create(['user_id' => $landlordUser->id]);
        $room = StoreRooms::factory()->create(['landlord_id' => $landlord->id]);
        $reservation = Reservations::factory()->create([
            'store_room_id' => $room->id,
            'status' => 'confirmed',
            'start_date' => today()->toDateString(),
            'end_date' => today()->addDays(30)->toDateString(),
            'rent_subtotal' => 3000,
            'total_mount' => 4180,
        ]);

        $response = $this->actingAs($landlordUser, 'sanctum')
            ->patchJson("/api/landlord/reservations/{$reservation->id}/cancel", [
                'reason' => 'El almacen sufrio un incendio',
            ]);

        $response->assertStatus(409);
        $this->assertDatabaseCount('reservation_cancellation_obligations', 0);
    }

    public function test_cannot_cancel_a_reservation_that_already_started()
    {
        $landlordUser = User::factory()->create(['role' => 'landlord']);
        $landlord = Landlords::factory()->create(['user_id' => $landlordUser->id]);
        $room = StoreRooms::factory()->create(['landlord_id' => $landlord->id]);
        $reservation = Reservations::factory()->create([
            'store_room_id' => $room->id,
            'status' => 'confirmed',
            'start_date' => today()->subDays(2)->toDateString(),
            'end_date' => today()->addDays(30)->toDateString(),
            'rent_subtotal' => 3000,
            'total_mount' => 4180,
        ]);

        $response = $this->actingAs($landlordUser, 'sanctum')
            ->patchJson("/api/landlord/reservations/{$reservation->id}/cancel", [
                'reason' => 'El almacen sufrio un incendio',
            ]);

        $response->assertStatus(409);
        $this->assertDatabaseCount('reservation_cancellation_obligations', 0);
    }

    public function test_reason_shorter_than_ten_characters_is_rejected()
    {
        $landlordUser = User::factory()->create(['role' => 'landlord']);
        $landlord = Landlords::factory()->create(['user_id' => $landlordUser->id]);
        $reservation = $this->eligibleReservation($landlord);

        $response = $this->actingAs($landlordUser, 'sanctum')
            ->patchJson("/api/landlord/reservations/{$reservation->id}/cancel", [
                'reason' => 'corto',
            ]);

        $response->assertStatus(422);
        $this->assertDatabaseHas('reservations', [
            'id' => $reservation->id,
            'status' => 'confirmed',
        ]);
    }

    public function test_non_owning_landlord_cannot_cancel()
    {
        $ownerUser = User::factory()->create(['role' => 'landlord']);
        $owner = Landlords::factory()->create(['user_id' => $ownerUser->id]);
        $reservation = $this->eligibleReservation($owner);

        $intruderUser = User::factory()->create(['role' => 'landlord']);
        Landlords::factory()->create(['user_id' => $intruderUser->id]);

        $response = $this->actingAs($intruderUser, 'sanctum')
            ->patchJson("/api/landlord/reservations/{$reservation->id}/cancel", [
                'reason' => 'El almacen sufrio un incendio',
            ]);

        $response->assertStatus(403);
        $this->assertDatabaseHas('reservations', [
            'id' => $reservation->id,
            'status' => 'confirmed',
        ]);
    }

    public function test_user_without_landlord_profile_gets_404_canceling_reservation()
    {
        $user = User::factory()->create();
        $room = StoreRooms::factory()->create();
        $reservation = Reservations::factory()->create([
            'store_room_id' => $room->id,
            'status' => 'confirmed',
            'start_date' => now()->addDays(5)->toDateString(),
            'end_date' => now()->addDays(35)->toDateString(),
            'rent_subtotal' => 3000,
            'total_mount' => 4180,
        ]);

        $response = $this->actingAs($user, 'sanctum')
            ->patchJson("/api/landlord/reservations/{$reservation->id}/cancel", [
                'reason' => 'El almacen sufrio un incendio',
            ]);

        $response->assertStatus(404);
    }

    public function test_missing_reservation_returns_404()
    {
        $landlordUser = User::factory()->create(['role' => 'landlord']);
        Landlords::factory()->create(['user_id' => $landlordUser->id]);

        $response = $this->actingAs($landlordUser, 'sanctum')
            ->patchJson('/api/landlord/reservations/999999/cancel', [
                'reason' => 'El almacen sufrio un incendio',
            ]);

        $response->assertStatus(404);
    }

    public function test_old_status_route_returns_404()
    {
        $landlordUser = User::factory()->create(['role' => 'landlord']);
        $landlord = Landlords::factory()->create(['user_id' => $landlordUser->id]);
        $reservation = $this->eligibleReservation($landlord);

        $response = $this->actingAs($landlordUser, 'sanctum')
            ->patchJson("/api/landlord/reservations/{$reservation->id}/status", [
                'status' => 'canceled',
            ]);

        $response->assertStatus(404);
    }
}
