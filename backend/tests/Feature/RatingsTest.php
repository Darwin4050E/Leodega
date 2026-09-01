<?php

namespace Tests\Feature;

use App\Models\Ratings;
use App\Models\StoreRooms;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class RatingsTest extends TestCase
{
    use RefreshDatabase;

    /** @test */
    public function tenant_can_publish_rating()
    {
        // TC-B-19
        $user = User::factory()->create();
        $storeRoom = StoreRooms::factory()->create();

        $response = $this->actingAs($user, 'sanctum')
            ->postJson('/api/ratings', [
                'store_id' => $storeRoom->id,
                'stars' => 5,
                'comment' => 'Excelente bodega',
            ]);

        $response->assertStatus(201);

        $this->assertDatabaseHas('ratings', [
            'store_id' => $storeRoom->id,
            'user_id' => $user->id,
            'stars' => 5,
        ]);
    }

    /** @test */
    public function store_room_rating_average_is_recalculated()
    {
        // TC-B-20
        $storeRoom = StoreRooms::factory()->create();

        Ratings::factory()->create([
            'store_id' => $storeRoom->id,
            'stars' => 4,
        ]);

        Ratings::factory()->create([
            'store_id' => $storeRoom->id,
            'stars' => 5,
        ]);

        $response = $this->getJson('/api/storeRooms');

        $response->assertStatus(200)
            ->assertJsonFragment([
                'rating_avg' => 4.5,
            ]);
    }

    /**
     * Fase 3: esta regla vivía inline en el controlador sin ningún test que la
     * cubriera. Ahora vive en RatingsService::create() y queda probada tanto
     * a nivel HTTP (aquí) como a nivel unitario (tests/Unit/RatingsServiceTest.php).
     */
    public function test_cannot_rate_the_same_store_room_twice()
    {
        $user = User::factory()->create();
        $storeRoom = StoreRooms::factory()->create();

        Ratings::factory()->create([
            'store_id' => $storeRoom->id,
            'user_id' => $user->id,
        ]);

        $response = $this->actingAs($user, 'sanctum')
            ->postJson('/api/ratings', [
                'store_id' => $storeRoom->id,
                'stars' => 3,
                'comment' => 'Repetido',
            ]);

        $response->assertStatus(409);
        $response->assertJson(['message' => 'Ya calificaste esta bodega']);
        $this->assertDatabaseCount('ratings', 1);
    }
}
