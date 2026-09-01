<?php

namespace Tests\Feature;

use App\Models\Landlords;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class LandlordsTest extends TestCase
{
    use RefreshDatabase;

    // GET se mantiene público: se usa en fichas de bodega públicas.
    public function test_index_returns_landlords_without_authentication()
    {
        Landlords::factory()->count(2)->create();

        $response = $this->getJson('/api/landlords');

        $response->assertStatus(200);
        $response->assertJsonCount(2);
    }

    // Fase 0.5: escritura ahora requiere sesión (antes, cualquiera podía dar de
    // alta/editar/borrar un landlord sin autenticarse).
    public function test_store_requires_authentication()
    {
        $user = User::factory()->create(['role' => 'landlord']);

        $response = $this->postJson('/api/landlords', [
            'user_id' => $user->id,
        ]);

        $response->assertStatus(401);
    }

    public function test_store_creates_landlord_for_existing_user_when_authenticated()
    {
        $caller = User::factory()->create();
        $user = User::factory()->create(['role' => 'landlord']);

        $response = $this->actingAs($caller, 'sanctum')->postJson('/api/landlords', [
            'user_id' => $user->id,
            'optional_company' => 'Bodegas SA',
        ]);

        $response->assertStatus(201);
        $this->assertDatabaseHas('landlords', ['user_id' => $user->id]);
    }

    public function test_store_fails_when_user_does_not_exist()
    {
        $caller = User::factory()->create();

        $response = $this->actingAs($caller, 'sanctum')->postJson('/api/landlords', [
            'user_id' => 999999,
        ]);

        $response->assertStatus(400);
        $response->assertJsonValidationErrors(['user_id']);
    }

    public function test_destroy_requires_authentication()
    {
        $landlord = Landlords::factory()->create();

        $response = $this->deleteJson("/api/landlords/{$landlord->id}");

        $response->assertStatus(401);
    }

    public function test_destroy_deletes_landlord_when_authenticated()
    {
        $caller = User::factory()->create();
        $landlord = Landlords::factory()->create();

        $response = $this->actingAs($caller, 'sanctum')->deleteJson("/api/landlords/{$landlord->id}");

        $response->assertStatus(200);
        $this->assertDatabaseMissing('landlords', ['id' => $landlord->id]);
    }
}
