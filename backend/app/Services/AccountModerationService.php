<?php

namespace App\Services;

use App\Enums\NotificationType;
use App\Exceptions\AccountModerationException;
use App\Models\AccountModeration;
use App\Models\User;
use Illuminate\Support\Facades\DB;

/**
 * Espeja StoreModerationService: una sola transacción concentra la mutación de
 * `user.state`, el registro de auditoría en `account_moderation`, la
 * notificación al usuario afectado y (en el bloqueo) la revocación de todos los
 * tokens de Sanctum. Los guards viven aquí para que tanto los tests unitarios
 * como los de feature los cubran.
 */
class AccountModerationService
{
    /**
     * @throws AccountModerationException 403 self/target-admin · 409 ya bloqueada
     */
    public function block(User $target, string $reason, int $adminId): AccountModeration
    {
        $this->assertModeratable($target, $adminId);

        if ($target->state === 'blocked') {
            throw AccountModerationException::conflict('La cuenta ya está bloqueada');
        }

        return DB::transaction(function () use ($target, $reason, $adminId) {
            $target->update(['state' => 'blocked']);

            $moderation = AccountModeration::create([
                'user_id' => $target->id,
                'admin_id' => $adminId,
                'action' => 'block',
                'reason' => $reason,
                'moderation_date' => now(),
            ]);

            NotificationService::send(
                $adminId,
                $target->id,
                NotificationType::ACCOUNT_BLOCKED,
                'Tu cuenta ha sido bloqueada',
                $reason,
                ['moderation_id' => $moderation->id],
            );

            // Última operación de la transacción: si algo anterior falla, la
            // revocación también se revierte.
            $target->tokens()->delete();

            return $moderation;
        });
    }

    /**
     * @throws AccountModerationException 403 self/target-admin · 409 ya activa
     */
    public function reactivate(User $target, int $adminId): AccountModeration
    {
        $this->assertModeratable($target, $adminId);

        if ($target->state === 'active') {
            throw AccountModerationException::conflict('La cuenta ya está activa');
        }

        return DB::transaction(function () use ($target, $adminId) {
            $target->update(['state' => 'active']);

            return AccountModeration::create([
                'user_id' => $target->id,
                'admin_id' => $adminId,
                'action' => 'reactivate',
                'reason' => null,
                'moderation_date' => now(),
            ]);
        });
    }

    private function assertModeratable(User $target, int $adminId): void
    {
        if ($target->id === $adminId) {
            throw AccountModerationException::denied('No puedes moderar tu propia cuenta');
        }

        if ($target->role === 'admin') {
            throw AccountModerationException::denied('No puedes moderar a otro administrador');
        }
    }
}
