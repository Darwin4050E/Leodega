<?php

namespace Tests\Feature;

use App\Models\Landlords;
use App\Models\Reservations;
use App\Models\StoreRooms;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class StoreRoomDeletionTest extends TestCase
{
    use RefreshDatabase;

    private function makeLandlordUser(): array
    {
        $user = User::factory()->create(['role' => 'landlord']);
        $landlord = Landlords::factory()->create(['user_id' => $user->id]);

        return [$user, $landlord];
    }

    public function test_owner_deletes_storeroom_with_no_blocking_reservations()
    {
        [$user, $landlord] = $this->makeLandlordUser();
        $room = StoreRooms::factory()->create(['landlord_id' => $landlord->id]);

        $response = $this->actingAs($user, 'sanctum')
            ->deleteJson("/api/storeRooms/{$room->id}");

        $response->assertStatus(200);
        $response->assertJson(['message' => 'Bodega eliminada correctamente', 'status' => 200]);
        $this->assertSoftDeleted('storeRooms', ['id' => $room->id]);
    }

    public function test_non_owner_landlord_cannot_delete_storeroom()
    {
        [, $ownerLandlord] = $this->makeLandlordUser();
        $room = StoreRooms::factory()->create(['landlord_id' => $ownerLandlord->id]);

        [$otherUser] = $this->makeLandlordUser();

        $response = $this->actingAs($otherUser, 'sanctum')
            ->deleteJson("/api/storeRooms/{$room->id}");

        $response->assertStatus(403);
        $this->assertDatabaseHas('storeRooms', ['id' => $room->id, 'deleted_at' => null]);
    }

    public function test_deletion_blocked_by_confirmed_reservation_with_future_end_date()
    {
        [$user, $landlord] = $this->makeLandlordUser();
        $room = StoreRooms::factory()->create(['landlord_id' => $landlord->id]);

        Reservations::factory()->create([
            'store_room_id' => $room->id,
            'status' => 'confirmed',
            'end_date' => now()->addDays(5),
        ]);

        $response = $this->actingAs($user, 'sanctum')
            ->deleteJson("/api/storeRooms/{$room->id}");

        $response->assertStatus(409);
        $this->assertDatabaseHas('storeRooms', ['id' => $room->id, 'deleted_at' => null]);
    }

    public function test_deletion_blocked_by_confirmed_reservation_ending_today_boundary()
    {
        [$user, $landlord] = $this->makeLandlordUser();
        $room = StoreRooms::factory()->create(['landlord_id' => $landlord->id]);

        Reservations::factory()->create([
            'store_room_id' => $room->id,
            'status' => 'confirmed',
            'end_date' => today(),
        ]);

        $response = $this->actingAs($user, 'sanctum')
            ->deleteJson("/api/storeRooms/{$room->id}");

        $response->assertStatus(409);
        $this->assertDatabaseHas('storeRooms', ['id' => $room->id, 'deleted_at' => null]);
    }

    public function test_deletion_allowed_when_only_canceled_or_past_reservations_exist()
    {
        [$user, $landlord] = $this->makeLandlordUser();
        $room = StoreRooms::factory()->create(['landlord_id' => $landlord->id]);

        $pastReservation = Reservations::factory()->create([
            'store_room_id' => $room->id,
            'status' => 'confirmed',
            'end_date' => now()->subDays(3),
        ]);

        $canceledReservation = Reservations::factory()->create([
            'store_room_id' => $room->id,
            'status' => 'canceled',
            'end_date' => now()->addDays(3),
        ]);

        $response = $this->actingAs($user, 'sanctum')
            ->deleteJson("/api/storeRooms/{$room->id}");

        $response->assertStatus(200);
        $this->assertSoftDeleted('storeRooms', ['id' => $room->id]);
        $this->assertDatabaseHas('reservations', ['id' => $pastReservation->id, 'status' => 'confirmed']);
        $this->assertDatabaseHas('reservations', ['id' => $canceledReservation->id, 'status' => 'canceled']);
    }

    public function test_pending_reservations_are_canceled_on_successful_deletion()
    {
        [$user, $landlord] = $this->makeLandlordUser();
        $room = StoreRooms::factory()->create(['landlord_id' => $landlord->id]);

        $pending = Reservations::factory()->create([
            'store_room_id' => $room->id,
            'status' => 'pending',
            'end_date' => now()->addDays(2),
        ]);

        $response = $this->actingAs($user, 'sanctum')
            ->deleteJson("/api/storeRooms/{$room->id}");

        $response->assertStatus(200);
        $this->assertDatabaseHas('reservations', [
            'id' => $pending->id,
            'status' => 'canceled',
            'cancelation_reason' => 'Storeroom deleted by landlord',
        ]);
    }

    public function test_active_reservations_count_reflects_blocking_predicate_only()
    {
        [$user, $landlord] = $this->makeLandlordUser();
        $room = StoreRooms::factory()->create(['landlord_id' => $landlord->id]);

        Reservations::factory()->create([
            'store_room_id' => $room->id,
            'status' => 'confirmed',
            'end_date' => now()->addDays(3),
        ]);
        Reservations::factory()->create([
            'store_room_id' => $room->id,
            'status' => 'confirmed',
            'end_date' => now()->subDays(3),
        ]);
        Reservations::factory()->create([
            'store_room_id' => $room->id,
            'status' => 'pending',
            'end_date' => now()->addDays(3),
        ]);
        Reservations::factory()->create([
            'store_room_id' => $room->id,
            'status' => 'canceled',
            'end_date' => now()->addDays(3),
        ]);

        $response = $this->actingAs($user, 'sanctum')
            ->getJson("/api/landlords/{$landlord->id}/storeRooms");

        $response->assertStatus(200);
        $response->assertJsonFragment(['id' => $room->id, 'active_reservations_count' => 1]);
    }

    public function test_delete_fails_with_404_when_authenticated_user_has_no_landlord_profile()
    {
        $user = User::factory()->create(['role' => 'landlord']);
        $room = StoreRooms::factory()->create();

        $response = $this->actingAs($user, 'sanctum')
            ->deleteJson("/api/storeRooms/{$room->id}");

        $response->assertStatus(404);
    }

    public function test_delete_fails_with_404_for_nonexistent_storeroom()
    {
        [$user] = $this->makeLandlordUser();

        $response = $this->actingAs($user, 'sanctum')
            ->deleteJson('/api/storeRooms/999999');

        $response->assertStatus(404);
        $response->assertJson(['message' => 'Bodega no encontrada', 'status' => 404]);
    }

    public function test_delete_fails_with_404_for_already_soft_deleted_storeroom()
    {
        [$user, $landlord] = $this->makeLandlordUser();
        $room = StoreRooms::factory()->create(['landlord_id' => $landlord->id]);
        $room->delete();

        $response = $this->actingAs($user, 'sanctum')
            ->deleteJson("/api/storeRooms/{$room->id}");

        $response->assertStatus(404);
    }

    public function test_unauthenticated_request_cannot_delete_storeroom()
    {
        [, $landlord] = $this->makeLandlordUser();
        $room = StoreRooms::factory()->create(['landlord_id' => $landlord->id]);

        $response = $this->deleteJson("/api/storeRooms/{$room->id}");

        $response->assertStatus(401);
        $this->assertDatabaseHas('storeRooms', ['id' => $room->id, 'deleted_at' => null]);
    }
}
