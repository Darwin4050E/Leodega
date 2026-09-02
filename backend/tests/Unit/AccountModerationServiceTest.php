<?php

namespace Tests\Unit;

use App\Enums\NotificationType;
use App\Exceptions\AccountModerationException;
use App\Models\AccountModeration;
use App\Models\User;
use App\Services\AccountModerationService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AccountModerationServiceTest extends TestCase
{
    use RefreshDatabase;

    private function service(): AccountModerationService
    {
        return new AccountModerationService;
    }

    public function test_block_sets_state_writes_audit_row_notifies_and_revokes_tokens()
    {
        $admin = User::factory()->create(['role' => 'admin']);
        $target = User::factory()->create(['role' => 'tenant', 'state' => 'active']);
        $target->createToken('auth_token');
        $target->createToken('another');

        $moderation = $this->service()->block($target, 'Comportamiento abusivo', $admin->id);

        $this->assertSame('blocked', $target->fresh()->state);
        $this->assertDatabaseHas('account_moderation', [
            'id' => $moderation->id,
            'user_id' => $target->id,
            'admin_id' => $admin->id,
            'action' => 'block',
            'reason' => 'Comportamiento abusivo',
        ]);
        $this->assertDatabaseHas('notifications', [
            'sender_id' => $admin->id,
            'receiver_id' => $target->id,
            'type' => NotificationType::ACCOUNT_BLOCKED->value,
        ]);
        $this->assertSame(0, $target->tokens()->count());
    }

    public function test_block_rolls_back_every_effect_when_the_transaction_fails()
    {
        $admin = User::factory()->create(['role' => 'admin']);
        $target = User::factory()->create(['role' => 'tenant', 'state' => 'active']);
        $target->createToken('auth_token');

        // Fuerza un fallo dentro de la transacción, después de que el estado ya
        // se cambió: un listener del evento `created` del registro de auditoría
        // lanza una excepción, que debe provocar el rollback completo (estado,
        // fila de auditoría, notificación y revocación de tokens).
        AccountModeration::created(function () {
            throw new \RuntimeException('boom');
        });

        try {
            $this->service()->block($target, 'Motivo válido', $admin->id);
            $this->fail('Se esperaba una excepción dentro de la transacción');
        } catch (\RuntimeException $e) {
            $this->assertSame('boom', $e->getMessage());
        }

        $this->assertSame('active', $target->fresh()->state);
        $this->assertDatabaseCount('account_moderation', 0);
        $this->assertDatabaseCount('notifications', 0);
        $this->assertSame(1, $target->tokens()->count());
    }

    public function test_reactivate_sets_state_active_and_writes_audit_row_without_reason()
    {
        $admin = User::factory()->create(['role' => 'admin']);
        $target = User::factory()->create(['role' => 'tenant', 'state' => 'blocked']);

        $moderation = $this->service()->reactivate($target, $admin->id);

        $this->assertSame('active', $target->fresh()->state);
        $this->assertDatabaseHas('account_moderation', [
            'id' => $moderation->id,
            'user_id' => $target->id,
            'admin_id' => $admin->id,
            'action' => 'reactivate',
            'reason' => null,
        ]);
        $this->assertDatabaseCount('notifications', 0);
    }

    public function test_self_target_is_denied()
    {
        $admin = User::factory()->create(['role' => 'admin']);

        $this->expectException(AccountModerationException::class);
        $this->service()->block($admin, 'Motivo válido', $admin->id);
    }

    public function test_targeting_another_admin_is_denied()
    {
        $admin = User::factory()->create(['role' => 'admin']);
        $other = User::factory()->create(['role' => 'admin', 'state' => 'active']);

        try {
            $this->service()->block($other, 'Motivo válido', $admin->id);
            $this->fail('Se esperaba AccountModerationException');
        } catch (AccountModerationException $e) {
            $this->assertSame(403, $e->statusCode);
        }

        $this->assertSame('active', $other->fresh()->state);
        $this->assertDatabaseCount('account_moderation', 0);
    }

    public function test_blocking_an_already_blocked_user_conflicts_without_side_effects()
    {
        $admin = User::factory()->create(['role' => 'admin']);
        $target = User::factory()->create(['role' => 'tenant', 'state' => 'blocked']);

        try {
            $this->service()->block($target, 'Motivo válido', $admin->id);
            $this->fail('Se esperaba AccountModerationException');
        } catch (AccountModerationException $e) {
            $this->assertSame(409, $e->statusCode);
        }

        $this->assertDatabaseCount('account_moderation', 0);
    }

    public function test_reactivating_an_already_active_user_conflicts_without_audit_row()
    {
        $admin = User::factory()->create(['role' => 'admin']);
        $target = User::factory()->create(['role' => 'tenant', 'state' => 'active']);

        try {
            $this->service()->reactivate($target, $admin->id);
            $this->fail('Se esperaba AccountModerationException');
        } catch (AccountModerationException $e) {
            $this->assertSame(409, $e->statusCode);
        }

        $this->assertDatabaseCount('account_moderation', 0);
    }
}
