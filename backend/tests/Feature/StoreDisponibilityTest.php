<?php

namespace Tests\Feature;

use App\Models\Landlords;
use App\Models\Reservations;
use App\Models\StoreDisponibility;
use App\Models\StoreRooms;
use App\Models\Tenants;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Covers the atomic Phase 2 fix: StoreStoreDisponibilityRequest's
 * store_id -> store_room_id field-name correction lands together with
 * ownership authorization (StoreRoomsPolicy::update) and confirmed-
 * reservation / block-vs-block overlap enforcement. Mirrors the ownership
 * test pattern in StoreRoomUpdateTest.php.
 */
class StoreDisponibilityTest extends TestCase
{
    use RefreshDatabase;

    private function makeLandlordUser(): array
    {
        $user = User::factory()->create(['role' => 'landlord']);
        $landlord = Landlords::factory()->create(['user_id' => $user->id]);

        return [$user, $landlord];
    }

    private function makeTenantUser(): User
    {
        $user = User::factory()->create(['role' => 'tenant']);
        Tenants::factory()->create(['user_id' => $user->id]);

        return $user;
    }

    private function ownedRoom(Landlords $landlord, array $overrides = []): StoreRooms
    {
        return StoreRooms::factory()->create(array_merge([
            'landlord_id' => $landlord->id,
        ], $overrides));
    }

    // --- Ownership-scoped creation ------------------------------------------

    public function test_owner_blocks_own_room_successfully()
    {
        [$user, $landlord] = $this->makeLandlordUser();
        $room = $this->ownedRoom($landlord);

        $response = $this->actingAs($user, 'sanctum')->postJson('/api/storeDisponibility', [
            'store_room_id' => $room->id,
            'start_date' => '2026-10-01',
            'end_date' => '2026-10-10',
        ]);

        $response->assertStatus(201);
        $this->assertDatabaseHas('store_disponibility', [
            'store_room_id' => $room->id,
            'start_date' => '2026-10-01',
            'end_date' => '2026-10-10',
        ]);
    }

    public function test_landlord_cannot_block_another_landlords_room()
    {
        [, $ownerLandlord] = $this->makeLandlordUser();
        $room = $this->ownedRoom($ownerLandlord);

        [$otherUser] = $this->makeLandlordUser();

        $response = $this->actingAs($otherUser, 'sanctum')->postJson('/api/storeDisponibility', [
            'store_room_id' => $room->id,
            'start_date' => '2026-10-01',
            'end_date' => '2026-10-10',
        ]);

        $response->assertStatus(403);
        $this->assertDatabaseCount('store_disponibility', 0);
    }

    public function test_tenant_cannot_block_any_storeroom()
    {
        $tenantUser = $this->makeTenantUser();
        [, $landlord] = $this->makeLandlordUser();
        $room = $this->ownedRoom($landlord);

        $response = $this->actingAs($tenantUser, 'sanctum')->postJson('/api/storeDisponibility', [
            'store_room_id' => $room->id,
            'start_date' => '2026-10-01',
            'end_date' => '2026-10-10',
        ]);

        $response->assertStatus(403);
    }

    public function test_unauthenticated_request_cannot_block()
    {
        [, $landlord] = $this->makeLandlordUser();
        $room = $this->ownedRoom($landlord);

        $response = $this->postJson('/api/storeDisponibility', [
            'store_room_id' => $room->id,
            'start_date' => '2026-10-01',
            'end_date' => '2026-10-10',
        ]);

        $response->assertStatus(401);
        $this->assertDatabaseCount('store_disponibility', 0);
    }

    // --- Overlap with confirmed reservation ---------------------------------

    public function test_block_overlapping_confirmed_reservation_is_rejected()
    {
        [$user, $landlord] = $this->makeLandlordUser();
        $room = $this->ownedRoom($landlord);
        Reservations::factory()->create([
            'store_room_id' => $room->id,
            'status' => 'confirmed',
            'start_date' => '2026-10-01',
            'end_date' => '2026-10-10',
        ]);

        $response = $this->actingAs($user, 'sanctum')->postJson('/api/storeDisponibility', [
            'store_room_id' => $room->id,
            'start_date' => '2026-10-03',
            'end_date' => '2026-10-05',
        ]);

        $response->assertStatus(422);
        $response->assertJsonPath(
            'message',
            'No se puede bloquear este rango de fechas porque se superpone con una reserva confirmada. '.
            'Para liberar estas fechas, cancela la reserva desde la sección de reservas; '.
            'se aplicarán las penalidades de la política de cancelación vigente.'
        );
        $response->assertJsonMissingPath('status');
        $this->assertDatabaseCount('store_disponibility', 0);
    }

    public function test_block_starting_exactly_on_reservation_end_date_is_rejected()
    {
        [$user, $landlord] = $this->makeLandlordUser();
        $room = $this->ownedRoom($landlord);
        Reservations::factory()->create([
            'store_room_id' => $room->id,
            'status' => 'confirmed',
            'start_date' => '2026-10-01',
            'end_date' => '2026-10-10',
        ]);

        $response = $this->actingAs($user, 'sanctum')->postJson('/api/storeDisponibility', [
            'store_room_id' => $room->id,
            'start_date' => '2026-10-10',
            'end_date' => '2026-10-15',
        ]);

        $response->assertStatus(422);
    }

    public function test_block_ending_exactly_on_reservation_start_date_is_rejected()
    {
        [$user, $landlord] = $this->makeLandlordUser();
        $room = $this->ownedRoom($landlord);
        Reservations::factory()->create([
            'store_room_id' => $room->id,
            'status' => 'confirmed',
            'start_date' => '2026-10-10',
            'end_date' => '2026-10-20',
        ]);

        $response = $this->actingAs($user, 'sanctum')->postJson('/api/storeDisponibility', [
            'store_room_id' => $room->id,
            'start_date' => '2026-10-05',
            'end_date' => '2026-10-10',
        ]);

        $response->assertStatus(422);
    }

    public function test_block_starting_the_day_after_reservation_end_date_is_allowed()
    {
        [$user, $landlord] = $this->makeLandlordUser();
        $room = $this->ownedRoom($landlord);
        Reservations::factory()->create([
            'store_room_id' => $room->id,
            'status' => 'confirmed',
            'start_date' => '2026-10-01',
            'end_date' => '2026-10-10',
        ]);

        $response = $this->actingAs($user, 'sanctum')->postJson('/api/storeDisponibility', [
            'store_room_id' => $room->id,
            'start_date' => '2026-10-11',
            'end_date' => '2026-10-15',
        ]);

        $response->assertStatus(201);
    }

    // --- Block-vs-block overlap ----------------------------------------------

    public function test_block_overlapping_an_existing_block_is_rejected()
    {
        [$user, $landlord] = $this->makeLandlordUser();
        $room = $this->ownedRoom($landlord);
        StoreDisponibility::create([
            'store_room_id' => $room->id,
            'start_date' => '2026-11-01',
            'end_date' => '2026-11-10',
        ]);

        $response = $this->actingAs($user, 'sanctum')->postJson('/api/storeDisponibility', [
            'store_room_id' => $room->id,
            'start_date' => '2026-11-05',
            'end_date' => '2026-11-20',
        ]);

        $response->assertStatus(422);
        $this->assertDatabaseCount('store_disponibility', 1);
    }

    // --- Input validation ------------------------------------------------------

    public function test_end_date_before_start_date_is_rejected()
    {
        [$user, $landlord] = $this->makeLandlordUser();
        $room = $this->ownedRoom($landlord);

        $response = $this->actingAs($user, 'sanctum')->postJson('/api/storeDisponibility', [
            'store_room_id' => $room->id,
            'start_date' => '2026-10-10',
            'end_date' => '2026-10-05',
        ]);

        $response->assertStatus(422);
        $response->assertJsonValidationErrors(['end_date']);
        $response->assertJsonMissingPath('status');
    }

    public function test_missing_required_fields_are_rejected()
    {
        [$user] = $this->makeLandlordUser();

        $response = $this->actingAs($user, 'sanctum')->postJson('/api/storeDisponibility', []);

        $response->assertStatus(422);
        $response->assertJsonValidationErrors(['store_room_id', 'start_date', 'end_date']);
    }

    public function test_nonexistent_storeroom_is_rejected()
    {
        [$user] = $this->makeLandlordUser();

        $response = $this->actingAs($user, 'sanctum')->postJson('/api/storeDisponibility', [
            'store_room_id' => 999999,
            'start_date' => '2026-10-01',
            'end_date' => '2026-10-10',
        ]);

        $response->assertStatus(422);
        $response->assertJsonValidationErrors(['store_room_id']);
    }

    // --- Ownership-scoped deletion -------------------------------------------

    public function test_owner_deletes_own_block()
    {
        [$user, $landlord] = $this->makeLandlordUser();
        $room = $this->ownedRoom($landlord);
        $block = StoreDisponibility::create([
            'store_room_id' => $room->id,
            'start_date' => '2026-10-01',
            'end_date' => '2026-10-10',
        ]);

        $response = $this->actingAs($user, 'sanctum')->deleteJson("/api/storeDisponibility/{$block->id}");

        $response->assertSuccessful();
        $this->assertDatabaseMissing('store_disponibility', ['id' => $block->id]);
    }

    public function test_non_owner_cannot_delete_a_block()
    {
        [, $ownerLandlord] = $this->makeLandlordUser();
        $room = $this->ownedRoom($ownerLandlord);
        $block = StoreDisponibility::create([
            'store_room_id' => $room->id,
            'start_date' => '2026-10-01',
            'end_date' => '2026-10-10',
        ]);

        [$otherUser] = $this->makeLandlordUser();

        $response = $this->actingAs($otherUser, 'sanctum')->deleteJson("/api/storeDisponibility/{$block->id}");

        $response->assertStatus(403);
        $this->assertDatabaseHas('store_disponibility', ['id' => $block->id]);
    }

    public function test_deleting_a_nonexistent_block_returns_404()
    {
        [$user] = $this->makeLandlordUser();

        $response = $this->actingAs($user, 'sanctum')->deleteJson('/api/storeDisponibility/999999');

        $response->assertStatus(404);
    }

    // --- destroy() skips the overlap check (freeing dates never conflicts) ---

    public function test_destroy_does_not_require_overlap_check()
    {
        [$user, $landlord] = $this->makeLandlordUser();
        $room = $this->ownedRoom($landlord);
        Reservations::factory()->create([
            'store_room_id' => $room->id,
            'status' => 'confirmed',
            'start_date' => '2026-10-01',
            'end_date' => '2026-10-10',
        ]);
        $block = StoreDisponibility::create([
            'store_room_id' => $room->id,
            'start_date' => '2026-11-01',
            'end_date' => '2026-11-10',
        ]);

        $response = $this->actingAs($user, 'sanctum')->deleteJson("/api/storeDisponibility/{$block->id}");

        $response->assertSuccessful();
    }
}
