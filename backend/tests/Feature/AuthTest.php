<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class AuthTest extends TestCase
{
    use RefreshDatabase;

    public function test_login_with_valid_credentials_returns_token()
    {
        $user = User::factory()->create([
            'email' => 'landlord@leodega.com',
            'password' => Hash::make('secret123'),
        ]);

        $response = $this->postJson('/api/login', [
            'email' => 'landlord@leodega.com',
            'password' => 'secret123',
        ]);

        $response->assertStatus(200);
        $response->assertJsonStructure(['status', 'message', 'user', 'token', 'token_type']);
        $response->assertJsonPath('status', 'success');
        $response->assertJsonPath('user.id', $user->id);
    }

    /**
     * Corrección de inconsistencia (ver PLAN_CORRECCION_INCONSISTENCIAS.md,
     * Fase 1.2): antes, login() no verificaba User.state en absoluto.
     */
    public function test_blocked_user_cannot_login()
    {
        User::factory()->create([
            'email' => 'bloqueado@leodega.com',
            'password' => Hash::make('secret123'),
            'state' => 'blocked',
        ]);

        $response = $this->postJson('/api/login', [
            'email' => 'bloqueado@leodega.com',
            'password' => 'secret123',
        ]);

        $response->assertStatus(403);
    }

    /**
     * El guard de la Fase 1.2 está acotado a 'blocked' a propósito: el
     * significado de 'pending' es parte del diseño de HUA-03 (Sprint 1),
     * todavía no planificado en detalle. Este test deja constancia explícita
     * de que 'pending' sigue sin bloquear el login hoy.
     */
    public function test_pending_user_can_still_login()
    {
        User::factory()->create([
            'email' => 'pendiente@leodega.com',
            'password' => Hash::make('secret123'),
            'state' => 'pending',
        ]);

        $response = $this->postJson('/api/login', [
            'email' => 'pendiente@leodega.com',
            'password' => 'secret123',
        ]);

        $response->assertStatus(200);
    }

    public function test_login_with_invalid_credentials_is_rejected()
    {
        User::factory()->create([
            'email' => 'landlord@leodega.com',
            'password' => Hash::make('secret123'),
        ]);

        $response = $this->postJson('/api/login', [
            'email' => 'landlord@leodega.com',
            'password' => 'wrong-password',
        ]);

        $response->assertStatus(401);
        $response->assertJsonPath('message', 'Credenciales inválidas');
    }

    public function test_register_creates_user_and_returns_token()
    {
        $response = $this->postJson('/api/register', [
            'name' => 'Nueva',
            'lastname' => 'Persona',
            'phone' => '0991234567',
            'email' => 'nueva@leodega.com',
            'password' => 'secret123',
        ]);

        $response->assertStatus(201);
        $response->assertJsonStructure(['status', 'message', 'user', 'token', 'token_type']);
        $this->assertDatabaseHas('user', ['email' => 'nueva@leodega.com']);
    }

    /**
     * Fase 1: la regla de validación de /register usaba `unique:users` (tabla
     * muerta, hallazgo #4 de la matriz de riesgo) en vez de `unique:user`
     * (tabla real) — corregido en AuthController::register. Antes, este mismo
     * request revenaba con 500 en vez de devolver un 422 de validación.
     */
    public function test_register_fails_with_duplicate_email()
    {
        User::factory()->create(['email' => 'existente@leodega.com']);

        $response = $this->postJson('/api/register', [
            'name' => 'Nueva',
            'lastname' => 'Persona',
            'phone' => '0991234567',
            'email' => 'existente@leodega.com',
            'password' => 'secret123',
        ]);

        $response->assertStatus(422);
        $response->assertJsonValidationErrors(['email']);
    }

    public function test_me_requires_authentication()
    {
        $response = $this->getJson('/api/me');

        $response->assertStatus(401);
    }

    public function test_me_returns_authenticated_user()
    {
        $user = User::factory()->create();

        $response = $this->actingAs($user, 'sanctum')->getJson('/api/me');

        $response->assertStatus(200);
        $response->assertJsonPath('user.id', $user->id);
    }

    public function test_logout_revokes_current_token()
    {
        $user = User::factory()->create();
        $token = $user->createToken('auth_token')->plainTextToken;

        $response = $this->withHeader('Authorization', "Bearer {$token}")
            ->postJson('/api/logout');

        $response->assertStatus(200);
        $this->assertDatabaseCount('personal_access_tokens', 0);
    }
}
