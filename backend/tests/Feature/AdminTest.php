<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AdminTest extends TestCase
{
    use RefreshDatabase;

    // Fase 0.5: /api/admin no tenía ninguna protección — CRUD completo de
    // administradores expuesto sin autenticación (hallazgo #1, el más crítico
    // de la matriz de riesgo). Ahora requiere sesión + role:admin.
    public function test_index_requires_authentication()
    {
        $response = $this->getJson('/api/admin');

        $response->assertStatus(401);
    }

    public function test_index_requires_admin_role()
    {
        $landlord = User::factory()->create(['role' => 'landlord']);

        $response = $this->actingAs($landlord, 'sanctum')->getJson('/api/admin');

        $response->assertStatus(403);
    }

    public function test_index_accessible_with_admin_role()
    {
        $admin = User::factory()->create(['role' => 'admin']);

        $response = $this->actingAs($admin, 'sanctum')->getJson('/api/admin');

        // indexModel responde 404 "No items found" cuando la tabla está vacía;
        // lo relevante aquí es que el gate de autorización deja pasar la
        // petición (no se corta en 401/403).
        $response->assertStatus(404);
    }

    public function test_store_requires_admin_role()
    {
        $tenant = User::factory()->create(['role' => 'tenant']);

        $response = $this->actingAs($tenant, 'sanctum')->postJson('/api/admin', [
            'user_id' => $tenant->id,
            'admin_level' => 1,
        ]);

        $response->assertStatus(403);
    }

    /**
     * Fase 1: la FK de `admin.user_id` apuntaba a la tabla muerta `users` en
     * vez de `user` (hallazgo #4 de la matriz de riesgo) — corregido en
     * 2026_07_31_100001_fix_admin_user_id_foreign_key.php. Antes, este mismo
     * request fallaba siempre con 500 por violación de integridad referencial.
     */
    public function test_store_creates_admin_record_as_admin()
    {
        $admin = User::factory()->create(['role' => 'admin']);
        $target = User::factory()->create(['role' => 'admin']);

        $response = $this->actingAs($admin, 'sanctum')->postJson('/api/admin', [
            'user_id' => $target->id,
            'admin_level' => 1,
        ]);

        $response->assertStatus(201);
        $this->assertDatabaseHas('admin', ['user_id' => $target->id, 'admin_level' => 1]);
    }
}
