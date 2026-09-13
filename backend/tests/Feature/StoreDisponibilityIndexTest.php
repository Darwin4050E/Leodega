<?php

namespace Tests\Feature;

use App\Models\Landlords;
use App\Models\StoreDisponibility;
use App\Models\StoreRooms;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Obs #263 scope addition: GET /storeDisponibility must return 200 with an
 * empty array when the authenticated landlord has no blocks, scoped to
 * their own storerooms only. ApiController::indexModel() 404s on an empty
 * collection; that generic behavior is NOT touched here (separate cycle),
 * only StoreDisponibilityController::index() stops using it.
 */
class StoreDisponibilityIndexTest extends TestCase
{
    use RefreshDatabase;

    private function makeLandlordUser(): array
    {
        $user = User::factory()->create(['role' => 'landlord']);
        $landlord = Landlords::factory()->create(['user_id' => $user->id]);

        return [$user, $landlord];
    }

    public function test_landlord_with_zero_blocks_gets_200_empty_array()
    {
        [$user] = $this->makeLandlordUser();

        $response = $this->actingAs($user, 'sanctum')->getJson('/api/storeDisponibility');

        $response->assertStatus(200);
        $response->assertExactJson([]);
    }

    public function test_landlord_sees_only_their_own_storerooms_blocks()
    {
        [$user, $landlord] = $this->makeLandlordUser();
        $ownRoom = StoreRooms::factory()->create(['landlord_id' => $landlord->id]);
        $ownBlock = StoreDisponibility::create([
            'store_room_id' => $ownRoom->id,
            'start_date' => '2026-10-01',
            'end_date' => '2026-10-10',
        ]);

        [, $otherLandlord] = $this->makeLandlordUser();
        $otherRoom = StoreRooms::factory()->create(['landlord_id' => $otherLandlord->id]);
        StoreDisponibility::create([
            'store_room_id' => $otherRoom->id,
            'start_date' => '2026-11-01',
            'end_date' => '2026-11-10',
        ]);

        $response = $this->actingAs($user, 'sanctum')->getJson('/api/storeDisponibility');

        $response->assertStatus(200);
        $response->assertJsonCount(1);
        $response->assertJsonPath('0.id', $ownBlock->id);
    }
}
