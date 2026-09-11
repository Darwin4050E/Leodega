<?php

namespace Tests\Feature;

use App\Models\Landlords;
use App\Models\Reservations;
use App\Models\StorePrices;
use App\Models\StoreRooms;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * HUG-08: the owning gestor edits an already published storeroom
 * (title, description, size, monthly price + disponibility). The
 * moderation branch of PUT /storeRooms/{id} is exercised separately in
 * StoreRoomModerationTest.
 */
class StoreRoomUpdateTest extends TestCase
{
    use RefreshDatabase;

    private function makeLandlordUser(): array
    {
        $user = User::factory()->create(['role' => 'landlord']);
        $landlord = Landlords::factory()->create(['user_id' => $user->id]);

        return [$user, $landlord];
    }

    private function ownedRoom(Landlords $landlord, array $overrides = []): StoreRooms
    {
        return StoreRooms::factory()->create(array_merge([
            'landlord_id' => $landlord->id,
            'publication_status' => 'approved',
        ], $overrides));
    }

    // --- Scenario 1: happy path -------------------------------------------------

    public function test_owner_edits_scalar_fields_successfully()
    {
        [$user, $landlord] = $this->makeLandlordUser();
        $room = $this->ownedRoom($landlord, ['title' => 'Antiguo', 'size' => 20]);

        $response = $this->actingAs($user, 'sanctum')->putJson("/api/storeRooms/{$room->id}", [
            'title' => 'Bodega renovada',
            'description' => 'Ahora con mejor acceso',
            'size' => 55.5,
        ]);

        $response->assertStatus(200);
        $response->assertJson([
            'message' => 'Los cambios se guardaron correctamente.',
            'status' => 200,
        ]);
        $response->assertJsonMissingPath('notice');

        $this->assertDatabaseHas('storeRooms', [
            'id' => $room->id,
            'title' => 'Bodega renovada',
            'description' => 'Ahora con mejor acceso',
            'size' => 55.5,
        ]);
    }

    public function test_owner_edits_monthly_price_and_other_price_rows_are_untouched()
    {
        [$user, $landlord] = $this->makeLandlordUser();
        $room = $this->ownedRoom($landlord);

        $monthly = StorePrices::factory()->create([
            'store_room_id' => $room->id,
            'mode' => 'month',
            'price' => 1000,
            'disponibility' => true,
        ]);
        $daily = StorePrices::factory()->create([
            'store_room_id' => $room->id,
            'mode' => 'day',
            'price' => 50,
            'disponibility' => true,
        ]);

        $response = $this->actingAs($user, 'sanctum')->putJson("/api/storeRooms/{$room->id}", [
            'price' => 1250.75,
            'disponibility' => false,
        ]);

        $response->assertStatus(200);
        $response->assertJsonPath('message', 'Los cambios se guardaron correctamente.');

        $this->assertDatabaseHas('store_prices', [
            'id' => $monthly->id,
            'mode' => 'month',
            'price' => 1250.75,
            'disponibility' => false,
        ]);
        $this->assertDatabaseHas('store_prices', [
            'id' => $daily->id,
            'mode' => 'day',
            'price' => 50,
            'disponibility' => true,
        ]);
        $this->assertDatabaseCount('store_prices', 2);
    }

    // --- Authorization / guards -----------------------------------------------

    public function test_non_owner_landlord_cannot_edit_and_nothing_changes()
    {
        [, $ownerLandlord] = $this->makeLandlordUser();
        $room = $this->ownedRoom($ownerLandlord, ['title' => 'Intacta']);

        [$otherUser] = $this->makeLandlordUser();

        $response = $this->actingAs($otherUser, 'sanctum')->putJson("/api/storeRooms/{$room->id}", [
            'title' => 'Secuestrada',
        ]);

        $response->assertStatus(403);
        $this->assertDatabaseHas('storeRooms', ['id' => $room->id, 'title' => 'Intacta']);
    }

    public function test_authenticated_user_without_landlord_profile_gets_404()
    {
        $user = User::factory()->create(['role' => 'landlord']);
        $room = StoreRooms::factory()->create();

        $response = $this->actingAs($user, 'sanctum')->putJson("/api/storeRooms/{$room->id}", [
            'title' => 'Nuevo',
        ]);

        $response->assertStatus(404);
    }

    public function test_nonexistent_room_gets_404()
    {
        [$user] = $this->makeLandlordUser();

        $response = $this->actingAs($user, 'sanctum')->putJson('/api/storeRooms/999999', [
            'title' => 'Nuevo',
        ]);

        $response->assertStatus(404);
    }

    public function test_soft_deleted_room_gets_404()
    {
        [$user, $landlord] = $this->makeLandlordUser();
        $room = $this->ownedRoom($landlord);
        $room->delete();

        $response = $this->actingAs($user, 'sanctum')->putJson("/api/storeRooms/{$room->id}", [
            'title' => 'Nuevo',
        ]);

        $response->assertStatus(404);
    }

    public function test_unauthenticated_request_cannot_edit()
    {
        [, $landlord] = $this->makeLandlordUser();
        $room = $this->ownedRoom($landlord, ['title' => 'Intacta']);

        $response = $this->putJson("/api/storeRooms/{$room->id}", ['title' => 'Hackeada']);

        $response->assertStatus(401);
        $this->assertDatabaseHas('storeRooms', ['id' => $room->id, 'title' => 'Intacta']);
    }

    // --- Scenario 2: validation is atomic ------------------------------------

    public function test_zero_price_is_rejected_and_nothing_is_saved()
    {
        [$user, $landlord] = $this->makeLandlordUser();
        $room = $this->ownedRoom($landlord, ['title' => 'Intacta']);
        StorePrices::factory()->create(['store_room_id' => $room->id, 'mode' => 'month', 'price' => 1000]);

        $response = $this->actingAs($user, 'sanctum')->putJson("/api/storeRooms/{$room->id}", [
            'title' => 'Cambiada',
            'price' => 0,
        ]);

        $response->assertStatus(400);
        $response->assertJsonValidationErrors(['price']);
        $this->assertDatabaseHas('storeRooms', ['id' => $room->id, 'title' => 'Intacta']);
        $this->assertDatabaseHas('store_prices', ['store_room_id' => $room->id, 'price' => 1000]);
    }

    public function test_negative_price_is_rejected()
    {
        [$user, $landlord] = $this->makeLandlordUser();
        $room = $this->ownedRoom($landlord);

        $response = $this->actingAs($user, 'sanctum')->putJson("/api/storeRooms/{$room->id}", [
            'price' => -5,
        ]);

        $response->assertStatus(400);
        $response->assertJsonValidationErrors(['price']);
        $response->assertJsonPath('message', 'Validation Error');
        $response->assertJsonPath('status', 400);
    }

    public function test_invalid_size_values_are_rejected_and_nothing_is_saved()
    {
        [$user, $landlord] = $this->makeLandlordUser();
        $room = $this->ownedRoom($landlord, ['size' => 30]);

        foreach ([0, -10, 'no-soy-un-numero'] as $badSize) {
            $response = $this->actingAs($user, 'sanctum')->putJson("/api/storeRooms/{$room->id}", [
                'size' => $badSize,
            ]);

            $response->assertStatus(400);
            $response->assertJsonValidationErrors(['size']);
        }

        $this->assertDatabaseHas('storeRooms', ['id' => $room->id, 'size' => 30]);
    }

    public function test_price_change_on_room_without_monthly_tariff_row_is_a_clear_error()
    {
        [$user, $landlord] = $this->makeLandlordUser();
        $room = $this->ownedRoom($landlord, ['title' => 'Intacta']);
        // only a daily row exists — no mode='month'
        StorePrices::factory()->create(['store_room_id' => $room->id, 'mode' => 'day', 'price' => 40]);

        $response = $this->actingAs($user, 'sanctum')->putJson("/api/storeRooms/{$room->id}", [
            'title' => 'Cambiada',
            'price' => 900,
        ]);

        $response->assertStatus(400);
        $response->assertJsonValidationErrors(['price']);
        // atomic: the title change rolled back too
        $this->assertDatabaseHas('storeRooms', ['id' => $room->id, 'title' => 'Intacta']);
    }

    // --- Scenario 3: existing reservations ----------------------------------

    public function test_edit_is_allowed_with_confirmed_future_reservation_and_returns_notice()
    {
        [$user, $landlord] = $this->makeLandlordUser();
        $room = $this->ownedRoom($landlord);
        StorePrices::factory()->create([
            'store_room_id' => $room->id,
            'mode' => 'month',
            'price' => 1000,
        ]);

        $reservation = Reservations::factory()->create([
            'store_room_id' => $room->id,
            'status' => 'confirmed',
            'end_date' => now()->addDays(20),
            'total_mount' => 100,
            'rent_subtotal' => 80,
        ]);

        $response = $this->actingAs($user, 'sanctum')->putJson("/api/storeRooms/{$room->id}", [
            'price' => 1500,
            'size' => 99,
        ]);

        $response->assertStatus(200);
        $response->assertJsonPath('message', 'Los cambios se guardaron correctamente.');
        $response->assertJsonPath(
            'notice',
            'Los cambios no afectan a las reservas ya confirmadas; solo aplican a nuevas reservas.'
        );

        // new terms applied to the listing
        $this->assertDatabaseHas('store_prices', ['store_room_id' => $room->id, 'mode' => 'month', 'price' => 1500]);
        // existing contract keeps its snapshot
        $this->assertDatabaseHas('reservations', [
            'id' => $reservation->id,
            'total_mount' => 100,
            'rent_subtotal' => 80,
        ]);
    }

    public function test_no_notice_when_only_past_or_canceled_reservations_exist()
    {
        [$user, $landlord] = $this->makeLandlordUser();
        $room = $this->ownedRoom($landlord);

        Reservations::factory()->create([
            'store_room_id' => $room->id,
            'status' => 'confirmed',
            'end_date' => now()->subDays(3),
        ]);
        Reservations::factory()->create([
            'store_room_id' => $room->id,
            'status' => 'canceled',
            'end_date' => now()->addDays(3),
        ]);

        $response = $this->actingAs($user, 'sanctum')->putJson("/api/storeRooms/{$room->id}", [
            'title' => 'Sin contratos vivos',
        ]);

        $response->assertStatus(200);
        $response->assertJsonMissingPath('notice');
    }

    // --- Out-of-scope fields are ignored ------------------------------------

    public function test_landlord_id_and_publication_status_in_payload_are_ignored()
    {
        [$user, $landlord] = $this->makeLandlordUser();
        $otherLandlord = Landlords::factory()->create();
        $room = $this->ownedRoom($landlord, ['publication_status' => 'approved']);

        $response = $this->actingAs($user, 'sanctum')->putJson("/api/storeRooms/{$room->id}", [
            'title' => 'Solo el título cambia',
            'landlord_id' => $otherLandlord->id,
            'publication_status' => 'pending',
        ]);

        $response->assertStatus(200);
        $this->assertDatabaseHas('storeRooms', [
            'id' => $room->id,
            'title' => 'Solo el título cambia',
            'landlord_id' => $landlord->id,
            'publication_status' => 'approved',
        ]);
    }
}
