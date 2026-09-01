<?php

namespace Tests\Feature;

use App\Models\Landlords;
use App\Models\Tenants;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class UserTest extends TestCase
{
    use RefreshDatabase;

    // --- Fase 0.5: GET /user ahora requiere sesión (lo consumen tanto admin
    // como la mensajería de landlord/tenant, por eso no se restringe a role:admin).

    public function test_index_requires_authentication()
    {
        $response = $this->getJson('/api/user');

        $response->assertStatus(401);
    }

    public function test_index_returns_404_when_no_users_exist_besides_the_caller()
    {
        $caller = User::factory()->create();

        $response = $this->actingAs($caller, 'sanctum')->getJson('/api/user');

        $response->assertStatus(200);
        $response->assertJsonCount(1);
    }

    public function test_index_returns_users_when_authenticated()
    {
        $caller = User::factory()->create();
        User::factory()->count(2)->create();

        $response = $this->actingAs($caller, 'sanctum')->getJson('/api/user');

        $response->assertStatus(200);
        $response->assertJsonCount(3);
    }

    public function test_show_requires_authentication()
    {
        $user = User::factory()->create();

        $response = $this->getJson("/api/user/{$user->id}");

        $response->assertStatus(401);
    }

    public function test_show_returns_existing_user_when_authenticated()
    {
        $caller = User::factory()->create();
        $user = User::factory()->create();

        $response = $this->actingAs($caller, 'sanctum')->getJson("/api/user/{$user->id}");

        $response->assertStatus(200);
        $response->assertJsonPath('id', $user->id);
    }

    public function test_show_returns_404_for_missing_user()
    {
        $caller = User::factory()->create();

        $response = $this->actingAs($caller, 'sanctum')->getJson('/api/user/999999');

        $response->assertStatus(404);
    }

    // --- POST /user se mantiene público a propósito: es el alta de cuenta real
    // (Decision.tsx) para landlord/tenant sin sesión previa.

    public function test_store_creates_landlord_and_related_landlord_profile_without_authentication()
    {
        $response = $this->postJson('/api/user', [
            'name' => 'Ana',
            'lastname' => 'Torres',
            'email' => 'ana@leodega.com',
            'phone' => '0991234567',
            'password' => 'secret123',
            'role' => 'landlord',
            'enable_messages' => true,
        ]);

        $response->assertStatus(201);
        $this->assertDatabaseHas('user', ['email' => 'ana@leodega.com', 'role' => 'landlord']);

        $user = User::where('email', 'ana@leodega.com')->firstOrFail();
        $this->assertTrue(Landlords::where('user_id', $user->id)->exists());
    }

    public function test_store_creates_tenant_and_related_tenant_profile_without_authentication()
    {
        $response = $this->postJson('/api/user', [
            'name' => 'Luis',
            'lastname' => 'Perez',
            'email' => 'luis@leodega.com',
            'phone' => '0997654321',
            'password' => 'secret123',
            'role' => 'tenant',
            'enable_messages' => true,
        ]);

        $response->assertStatus(201);

        $user = User::where('email', 'luis@leodega.com')->firstOrFail();
        $this->assertTrue(Tenants::where('user_id', $user->id)->exists());
    }

    /**
     * Fase 0.5: sin esta protección, cualquier visitante anónimo podía mandar
     * role=admin a este endpoint público y auto-promoverse a administrador.
     */
    public function test_store_rejects_anonymous_attempt_to_self_assign_admin_role()
    {
        $response = $this->postJson('/api/user', [
            'name' => 'Atacante',
            'lastname' => 'Anonimo',
            'email' => 'atacante@leodega.com',
            'phone' => '0990000000',
            'password' => 'secret123',
            'role' => 'admin',
            'enable_messages' => true,
        ]);

        $response->assertStatus(403);
        $this->assertDatabaseMissing('user', ['email' => 'atacante@leodega.com']);
    }

    // --- PUT/DELETE /user/{id} ahora requieren sesión de administrador: no hay
    // ningún flujo del frontend que edite/borre a otro usuario por id sin ser
    // admin (la autoedición pasa por /profile, ya protegido aparte).

    public function test_destroy_requires_authentication()
    {
        $user = User::factory()->create();

        $response = $this->deleteJson("/api/user/{$user->id}");

        $response->assertStatus(401);
    }

    public function test_destroy_requires_admin_role()
    {
        $caller = User::factory()->create(['role' => 'landlord']);
        $user = User::factory()->create();

        $response = $this->actingAs($caller, 'sanctum')->deleteJson("/api/user/{$user->id}");

        $response->assertStatus(403);
        $this->assertDatabaseHas('user', ['id' => $user->id]);
    }

    public function test_destroy_deletes_user_as_admin()
    {
        $admin = User::factory()->create(['role' => 'admin']);
        $user = User::factory()->create();

        $response = $this->actingAs($admin, 'sanctum')->deleteJson("/api/user/{$user->id}");

        $response->assertStatus(200);
        $this->assertDatabaseMissing('user', ['id' => $user->id]);
    }

    public function test_destroy_self_requires_authentication()
    {
        $response = $this->deleteJson('/api/account');

        $response->assertStatus(401);
    }

    public function test_destroy_self_deletes_authenticated_user()
    {
        $user = User::factory()->create();

        $response = $this->actingAs($user, 'sanctum')->deleteJson('/api/account');

        $response->assertStatus(200);
        $this->assertDatabaseMissing('user', ['id' => $user->id]);
    }
}
