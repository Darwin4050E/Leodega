<?php

namespace Tests\Feature;

use App\Models\Tenants;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class TenantsTest extends TestCase
{
    use RefreshDatabase;

    // Fase 0.5: /api/tenants ahora requiere sesión en todos sus métodos (no hay
    // ningún uso público de este endpoint desde el frontend).
    public function test_index_requires_authentication()
    {
        $response = $this->getJson('/api/tenants');

        $response->assertStatus(401);
    }

    public function test_index_returns_tenants_when_authenticated()
    {
        $caller = User::factory()->create();
        Tenants::factory()->count(2)->create();

        $response = $this->actingAs($caller, 'sanctum')->getJson('/api/tenants');

        $response->assertStatus(200);
        $response->assertJsonCount(2);
    }

    /**
     * Fase 1: la regla de validación de TenantsController::store usaba
     * `exists:users,id` (tabla muerta, hallazgo #4 de la matriz de riesgo) en
     * vez de `exists:user,id` (tabla real) — corregido. Antes, este mismo
     * request rechazaba SIEMPRE cualquier user_id real con un 400.
     */
    public function test_store_creates_tenant_for_existing_user()
    {
        $caller = User::factory()->create();
        $user = User::factory()->create(['role' => 'tenant']);

        $response = $this->actingAs($caller, 'sanctum')->postJson('/api/tenants', [
            'user_id' => $user->id,
            'search_preference' => 'price',
        ]);

        $response->assertStatus(201);
        $this->assertDatabaseHas('tenants', ['user_id' => $user->id]);
    }

    public function test_destroy_requires_authentication()
    {
        $tenant = Tenants::factory()->create();

        $response = $this->deleteJson("/api/tenants/{$tenant->id}");

        $response->assertStatus(401);
    }

    public function test_destroy_deletes_tenant_when_authenticated()
    {
        $caller = User::factory()->create();
        $tenant = Tenants::factory()->create();

        $response = $this->actingAs($caller, 'sanctum')->deleteJson("/api/tenants/{$tenant->id}");

        $response->assertStatus(200);
        $this->assertDatabaseMissing('tenants', ['id' => $tenant->id]);
    }
}
