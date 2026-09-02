<?php

namespace Tests\Feature;

use App\Enums\NotificationType;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AccountModerationTest extends TestCase
{
    use RefreshDatabase;

    private function admin(): User
    {
        return User::factory()->create(['role' => 'admin', 'state' => 'active']);
    }

    /**
     * Autentica con un Bearer token real (no `actingAs`) y olvida los guards
     * previamente resueltos. Necesario en tests que encadenan varias peticiones
     * con credenciales distintas: el guard de Sanctum memoiza el usuario de la
     * primera petición durante todo el método de prueba.
     */
    private function actingWithToken(User $user): self
    {
        $this->app['auth']->forgetGuards();

        return $this->withToken($user->createToken('auth_token')->plainTextToken);
    }

    // --- Auth / role gate -------------------------------------------------

    public function test_block_requires_authentication()
    {
        $target = User::factory()->create();

        $this->patchJson("/api/user/{$target->id}/block", ['reason' => 'Motivo válido'])
            ->assertStatus(401);
    }

    public function test_reactivate_requires_authentication()
    {
        $target = User::factory()->create(['state' => 'blocked']);

        $this->patchJson("/api/user/{$target->id}/reactivate")
            ->assertStatus(401);
    }

    public function test_block_requires_admin_role()
    {
        $caller = User::factory()->create(['role' => 'landlord']);
        $target = User::factory()->create(['role' => 'tenant']);

        $this->actingAs($caller, 'sanctum')
            ->patchJson("/api/user/{$target->id}/block", ['reason' => 'Motivo válido'])
            ->assertStatus(403);
    }

    public function test_reactivate_requires_admin_role()
    {
        $caller = User::factory()->create(['role' => 'tenant']);
        $target = User::factory()->create(['role' => 'tenant', 'state' => 'blocked']);

        $this->actingAs($caller, 'sanctum')
            ->patchJson("/api/user/{$target->id}/reactivate")
            ->assertStatus(403);
    }

    // --- Successful block ------------------------------------------------

    public function test_admin_blocks_an_active_user()
    {
        $admin = $this->admin();
        $target = User::factory()->create(['role' => 'tenant', 'state' => 'active']);

        $response = $this->actingAs($admin, 'sanctum')
            ->patchJson("/api/user/{$target->id}/block", ['reason' => 'Spam reiterado']);

        $response->assertStatus(200);
        $this->assertSame('blocked', $target->fresh()->state);
        $this->assertDatabaseHas('account_moderation', [
            'user_id' => $target->id,
            'admin_id' => $admin->id,
            'action' => 'block',
            'reason' => 'Spam reiterado',
        ]);
        $this->assertDatabaseHas('notifications', [
            'sender_id' => $admin->id,
            'receiver_id' => $target->id,
            'type' => NotificationType::ACCOUNT_BLOCKED->value,
        ]);
    }

    public function test_prior_bearer_token_is_rejected_after_block()
    {
        $admin = $this->admin();
        $target = User::factory()->create(['role' => 'tenant', 'state' => 'active']);
        $token = $target->createToken('auth_token')->plainTextToken;

        // El token funciona antes del bloqueo.
        $this->withToken($token)->getJson('/api/me')->assertStatus(200);

        $this->actingWithToken($admin)
            ->patchJson("/api/user/{$target->id}/block", ['reason' => 'Motivo válido'])
            ->assertStatus(200);

        $this->app['auth']->forgetGuards();
        $this->withToken($token)->getJson('/api/me')->assertStatus(401);

        $this->assertSame(0, $target->fresh()->tokens()->count());
    }

    // --- Guards --------------------------------------------------------

    public function test_admin_cannot_block_themselves()
    {
        $admin = $this->admin();

        $this->actingAs($admin, 'sanctum')
            ->patchJson("/api/user/{$admin->id}/block", ['reason' => 'Motivo válido'])
            ->assertStatus(403);

        $this->assertSame('active', $admin->fresh()->state);
        $this->assertDatabaseCount('account_moderation', 0);
    }

    public function test_admin_cannot_block_another_admin()
    {
        $admin = $this->admin();
        $other = User::factory()->create(['role' => 'admin', 'state' => 'active']);

        $this->actingAs($admin, 'sanctum')
            ->patchJson("/api/user/{$other->id}/block", ['reason' => 'Motivo válido'])
            ->assertStatus(403);

        $this->assertSame('active', $other->fresh()->state);
    }

    public function test_block_unknown_user_returns_404()
    {
        $admin = $this->admin();

        $this->actingAs($admin, 'sanctum')
            ->patchJson('/api/user/99999/block', ['reason' => 'Motivo válido'])
            ->assertStatus(404);
    }

    /**
     * @dataProvider blankReasonProvider
     */
    public function test_block_with_blank_reason_is_rejected(string $reason)
    {
        $admin = $this->admin();
        $target = User::factory()->create(['role' => 'tenant', 'state' => 'active']);
        $target->createToken('auth_token');

        $response = $this->actingAs($admin, 'sanctum')
            ->patchJson("/api/user/{$target->id}/block", ['reason' => $reason]);

        $response->assertStatus(422);
        $response->assertJsonValidationErrors(['reason']);
        $this->assertSame('active', $target->fresh()->state);
        $this->assertSame(1, $target->fresh()->tokens()->count());
        $this->assertDatabaseCount('account_moderation', 0);
        $this->assertDatabaseCount('notifications', 0);
    }

    public static function blankReasonProvider(): array
    {
        return [
            'empty' => [''],
            'whitespace' => ['          '],
        ];
    }

    public function test_blocking_an_already_blocked_user_conflicts_without_new_audit_row()
    {
        $admin = $this->admin();
        $target = User::factory()->create(['role' => 'tenant', 'state' => 'blocked']);

        $this->actingAs($admin, 'sanctum')
            ->patchJson("/api/user/{$target->id}/block", ['reason' => 'Motivo válido'])
            ->assertStatus(409);

        $this->assertDatabaseCount('account_moderation', 0);
    }

    // --- Reactivation --------------------------------------------------

    public function test_admin_reactivates_a_blocked_user()
    {
        $admin = $this->admin();
        $target = User::factory()->create(['role' => 'tenant', 'state' => 'blocked']);

        $this->actingAs($admin, 'sanctum')
            ->patchJson("/api/user/{$target->id}/reactivate")
            ->assertStatus(200);

        $this->assertSame('active', $target->fresh()->state);
        $this->assertDatabaseHas('account_moderation', [
            'user_id' => $target->id,
            'admin_id' => $admin->id,
            'action' => 'reactivate',
            'reason' => null,
        ]);
    }

    public function test_reactivating_an_already_active_user_conflicts_without_audit_row()
    {
        $admin = $this->admin();
        $target = User::factory()->create(['role' => 'tenant', 'state' => 'active']);

        $this->actingAs($admin, 'sanctum')
            ->patchJson("/api/user/{$target->id}/reactivate")
            ->assertStatus(409);

        $this->assertDatabaseCount('account_moderation', 0);
    }

    public function test_reactivated_user_can_log_in_again()
    {
        $admin = $this->admin();
        $target = User::factory()->create([
            'role' => 'tenant',
            'state' => 'blocked',
            'email' => 'reactivado@leodega.com',
            'password' => \Illuminate\Support\Facades\Hash::make('secret123'),
        ]);

        $this->actingWithToken($admin)
            ->patchJson("/api/user/{$target->id}/reactivate")
            ->assertStatus(200);

        // El middleware `auth.api:sanctum` fija `sanctum` como guard por defecto
        // durante el resto del método de prueba; hay que restaurar el guard web
        // antes de probar el login real (Auth::attempt no existe en Sanctum).
        $this->app['auth']->forgetGuards();
        $this->app['auth']->shouldUse('web');

        $this->postJson('/api/login', [
            'email' => 'reactivado@leodega.com',
            'password' => 'secret123',
        ])->assertStatus(200)->assertJsonStructure(['token']);
    }

    public function test_block_then_reactivate_writes_one_row_per_action()
    {
        $admin = $this->admin();
        $target = User::factory()->create(['role' => 'tenant', 'state' => 'active']);

        $this->actingAs($admin, 'sanctum')
            ->patchJson("/api/user/{$target->id}/block", ['reason' => 'Motivo válido'])
            ->assertStatus(200);

        $this->actingAs($admin, 'sanctum')
            ->patchJson("/api/user/{$target->id}/reactivate")
            ->assertStatus(200);

        $this->assertDatabaseCount('account_moderation', 2);
        $this->assertSame(1, \App\Models\AccountModeration::where('user_id', $target->id)->where('action', 'block')->count());
        $this->assertSame(1, \App\Models\AccountModeration::where('user_id', $target->id)->where('action', 'reactivate')->count());
    }
}
