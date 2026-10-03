<?php

namespace Tests\Feature;

use App\Models\Landlords;
use App\Models\Tenants;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

class UserTest extends TestCase
{
    use RefreshDatabase;

    // --- GET /user requires a session. Admins get the full row; every other
    // caller only gets the messaging-contact fields (id, name, lastname).

    public function test_index_requires_authentication()
    {
        $response = $this->getJson('/api/user');

        $response->assertStatus(401);
    }

    public function test_show_requires_authentication()
    {
        $user = User::factory()->create();

        $response = $this->getJson("/api/user/{$user->id}");

        $response->assertStatus(401);
    }

    public function test_admin_index_returns_the_full_rows()
    {
        $admin = User::factory()->create(['role' => 'admin']);
        User::factory()->count(2)->create();

        $response = $this->bearerAs($admin)->getJson('/api/user');

        $response->assertStatus(200);
        $response->assertJsonCount(3);
        $response->assertJsonStructure(['*' => ['id', 'name', 'lastname', 'email', 'phone', 'role', 'state']]);
    }

    public function test_admin_show_returns_the_full_row()
    {
        $admin = User::factory()->create(['role' => 'admin']);
        $target = User::factory()->create(['role' => 'tenant']);

        $response = $this->bearerAs($admin)->getJson("/api/user/{$target->id}");

        $response->assertStatus(200);
        $response->assertJsonStructure(['id', 'name', 'lastname', 'email', 'phone', 'role', 'state']);
        $response->assertJsonPath('id', $target->id);
        $response->assertJsonPath('email', $target->email);
        $response->assertJsonPath('phone', $target->phone);
        $response->assertJsonPath('role', 'tenant');
        $response->assertJsonMissingPath('password');
    }

    #[DataProvider('adminAndTenantProvider')]
    public function test_show_returns_404_for_missing_user(string $role)
    {
        $caller = User::factory()->create(['role' => $role]);

        $response = $this->bearerAs($caller)->getJson('/api/user/999999');

        $response->assertStatus(404);
    }

    public function test_tenant_cannot_update_another_user()
    {
        $caller = User::factory()->create(['role' => 'tenant']);
        $target = User::factory()->create(['name' => 'Antiguo']);

        $response = $this->bearerAs($caller)->putJson("/api/user/{$target->id}", ['name' => 'Nuevo']);

        $this->assertSame('Antiguo', $target->fresh()->name);
        $response->assertStatus(403);
    }

    public function test_index_with_only_the_caller_returns_one_item()
    {
        $caller = User::factory()->create(['role' => 'tenant']);

        $response = $this->bearerAs($caller)->getJson('/api/user');

        $response->assertStatus(200);
        $response->assertJsonCount(1);
    }

    public function test_non_admin_index_returns_only_id_name_and_lastname()
    {
        $caller = User::factory()->create(['role' => 'tenant']);
        User::factory()->count(2)->create();

        $response = $this->bearerAs($caller)->getJson('/api/user');

        $response->assertStatus(200);
        $response->assertJsonCount(3);
        foreach ($response->json() as $item) {
            $keys = array_keys($item);
            sort($keys);
            $this->assertSame(['id', 'lastname', 'name'], $keys);
        }
    }

    public function test_non_admin_show_returns_only_id_name_and_lastname()
    {
        $caller = User::factory()->create(['role' => 'tenant']);
        $target = User::factory()->create(['role' => 'landlord']);

        $response = $this->bearerAs($caller)->getJson("/api/user/{$target->id}");

        $response->assertStatus(200);
        $keys = array_keys($response->json());
        sort($keys);
        $this->assertSame(['id', 'lastname', 'name'], $keys);
        $response->assertJsonPath('id', $target->id);
        $response->assertJsonPath('name', $target->name);
        $response->assertJsonPath('lastname', $target->lastname);
    }

    #[DataProvider('projectionEndpointProvider')]
    public function test_non_admin_response_never_contains_email_or_phone(bool $listing)
    {
        $caller = User::factory()->create(['role' => 'tenant']);
        $target = User::factory()->create(['email' => 'secreto@leodega.com', 'phone' => '0998887776']);

        $response = $this->bearerAs($caller)->getJson($listing ? '/api/user' : "/api/user/{$target->id}");

        $response->assertStatus(200);
        $this->assertStringNotContainsString('secreto@leodega.com', $response->getContent());
        $this->assertStringNotContainsString('0998887776', $response->getContent());
    }

    public static function adminAndTenantProvider(): array
    {
        return [
            'admin' => ['admin'],
            'tenant' => ['tenant'],
        ];
    }

    public static function projectionEndpointProvider(): array
    {
        return [
            'index' => [true],
            'show' => [false],
        ];
    }

    private function bearerAs(User $user): static
    {
        $this->app['auth']->forgetGuards();

        return $this->withToken($user->createToken('auth_token')->plainTextToken);
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

    #[DataProvider('callerRoleProvider')]
    public function test_store_rejects_role_admin_for_every_caller(?string $role)
    {
        $caller = $this->callerAs($role);
        $adminsBefore = User::where('role', 'admin')->count();

        $response = $caller->postJson('/api/user', [
            'name' => 'Atacante',
            'lastname' => 'Escalada',
            'email' => 'escalada@leodega.com',
            'phone' => '0990000001',
            'password' => 'secret123',
            'role' => 'admin',
            'enable_messages' => true,
        ]);

        $response->assertStatus(403);
        $response->assertExactJson(['message' => 'No autorizado para crear un usuario con rol admin']);
        $this->assertDatabaseMissing('user', ['email' => 'escalada@leodega.com']);
        $this->assertSame($adminsBefore, User::where('role', 'admin')->count());
    }

    public function test_authenticated_tenant_can_register_landlord_and_tenant()
    {
        $caller = $this->callerAs('tenant');

        $caller->postJson('/api/user', [
            'name' => 'Marta',
            'lastname' => 'Rios',
            'email' => 'marta@leodega.com',
            'phone' => '0991111111',
            'password' => 'secret123',
            'role' => 'landlord',
            'enable_messages' => true,
        ])->assertStatus(201);

        $caller->postJson('/api/user', [
            'name' => 'Pedro',
            'lastname' => 'Mora',
            'email' => 'pedro@leodega.com',
            'phone' => '0992222222',
            'password' => 'secret123',
            'role' => 'tenant',
            'enable_messages' => true,
        ])->assertStatus(201);

        $landlord = User::where('email', 'marta@leodega.com')->firstOrFail();
        $tenant = User::where('email', 'pedro@leodega.com')->firstOrFail();
        $this->assertTrue(Landlords::where('user_id', $landlord->id)->exists());
        $this->assertTrue(Tenants::where('user_id', $tenant->id)->exists());
    }

    public static function callerRoleProvider(): array
    {
        return [
            'anonymous' => [null],
            'tenant' => ['tenant'],
            'landlord' => ['landlord'],
            'admin' => ['admin'],
        ];
    }

    private function callerAs(?string $role): static
    {
        if ($role === null) {
            return $this;
        }

        return $this->actingAs(User::factory()->create(['role' => $role]), 'sanctum');
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

    /**
     * HUA-03 (D6): `state` ya no es una regla de UpdateUserRequest, así que una
     * clave `state` en el body de PUT /user/{id} se ignora silenciosamente (no
     * 422) y el resto de campos válidos del mismo request sí se actualizan. Los
     * cambios de estado deben pasar por los endpoints de moderación.
     */
    public function test_update_ignores_state_in_body()
    {
        $admin = User::factory()->create(['role' => 'admin']);
        $target = User::factory()->create(['role' => 'tenant', 'state' => 'active', 'name' => 'Antiguo']);
        $target->createToken('auth_token');

        $response = $this->actingAs($admin, 'sanctum')->putJson("/api/user/{$target->id}", [
            'name' => 'Nuevo',
            'state' => 'blocked',
        ]);

        $response->assertStatus(200);
        $fresh = $target->fresh();
        $this->assertSame('active', $fresh->state);
        $this->assertSame('Nuevo', $fresh->name);
        $this->assertSame(1, $fresh->tokens()->count());
        $this->assertDatabaseCount('account_moderation', 0);
        $this->assertDatabaseCount('notifications', 0);
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
