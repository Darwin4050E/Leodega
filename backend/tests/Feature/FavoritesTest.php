<?php

namespace Tests\Feature;

use App\Models\StoreRooms;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class FavoritesTest extends TestCase
{
    use RefreshDatabase;

    // Fase 0.5: /api/favorites ahora requiere sesión en todos sus métodos — es
    // estado por-usuario, no tenía ninguna razón para ser público.
    public function test_index_requires_authentication()
    {
        $response = $this->getJson('/api/favorites');

        $response->assertStatus(401);
    }

    public function test_index_returns_favorites_when_authenticated()
    {
        $caller = User::factory()->create();
        $user = User::factory()->create();
        $storeRoom = StoreRooms::factory()->create();

        DB::table('favorites')->insert([
            'user_id' => $user->id,
            'store_room_id' => $storeRoom->id,
            'save_date' => now()->toDateString(),
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $response = $this->actingAs($caller, 'sanctum')->getJson('/api/favorites');

        $response->assertStatus(200);
        $response->assertJsonCount(1);
    }

    /**
     * FavoritesController::store validaba el campo `store_id`, pero la
     * columna real (y el $fillable del modelo) es `store_room_id` — el valor
     * validado nunca llegaba a guardarse en la columna correcta y la
     * creación fallaba siempre con 500. Corregido: la regla ahora valida
     * `store_room_id`, coincidiendo con la columna real.
     */
    public function test_store_creates_favorite_when_authenticated()
    {
        $caller = User::factory()->create();
        $storeRoom = StoreRooms::factory()->create();

        $response = $this->actingAs($caller, 'sanctum')->postJson('/api/favorites', [
            'user_id' => $caller->id,
            'store_room_id' => $storeRoom->id,
        ]);

        $response->assertStatus(201);
        $this->assertDatabaseHas('favorites', [
            'user_id' => $caller->id,
            'store_room_id' => $storeRoom->id,
        ]);
    }

    public function test_store_requires_authentication()
    {
        $user = User::factory()->create();
        $storeRoom = StoreRooms::factory()->create();

        $response = $this->postJson('/api/favorites', [
            'user_id' => $user->id,
            'store_room_id' => $storeRoom->id,
        ]);

        $response->assertStatus(401);
    }

    public function test_destroy_requires_authentication()
    {
        $user = User::factory()->create();
        $storeRoom = StoreRooms::factory()->create();

        $id = DB::table('favorites')->insertGetId([
            'user_id' => $user->id,
            'store_room_id' => $storeRoom->id,
            'save_date' => now()->toDateString(),
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $response = $this->deleteJson("/api/favorites/{$id}");

        $response->assertStatus(401);
    }

    public function test_destroy_deletes_favorite_when_authenticated()
    {
        $caller = User::factory()->create();
        $user = User::factory()->create();
        $storeRoom = StoreRooms::factory()->create();

        $id = DB::table('favorites')->insertGetId([
            'user_id' => $user->id,
            'store_room_id' => $storeRoom->id,
            'save_date' => now()->toDateString(),
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $response = $this->actingAs($caller, 'sanctum')->deleteJson("/api/favorites/{$id}");

        $response->assertStatus(200);
        $this->assertDatabaseMissing('favorites', ['id' => $id]);
    }
}
