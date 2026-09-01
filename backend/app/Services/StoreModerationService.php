<?php

namespace App\Services;

use App\Enums\NotificationType;
use App\Models\StoreModeration;
use App\Models\StoreRooms;
use Illuminate\Support\Facades\DB;
use InvalidArgumentException;

/**
 * Corrección de inconsistencia (ver PLAN_CORRECCION_INCONSISTENCIAS.md, Fase 2.1):
 * antes, `StoreRooms.publication_status` y `StoreModeration.status` eran dos
 * fuentes de verdad independientes -- ningún controlador las sincronizaba, y
 * ninguna transición disparaba una notificación al landlord (a diferencia de
 * ReservationService). Este servicio concentra ambos efectos en una sola
 * transacción, siguiendo el mismo patrón que ReservationService.
 */
class StoreModerationService
{
    /**
     * @throws InvalidArgumentException si $decision no es 'approved' ni 'rejected'.
     */
    public function moderate(StoreRooms $room, string $decision, ?string $reason, ?int $adminId): StoreModeration
    {
        if (! in_array($decision, ['approved', 'rejected'], true)) {
            throw new InvalidArgumentException("Decisión de moderación inválida: {$decision}");
        }

        return DB::transaction(function () use ($room, $decision, $reason, $adminId) {
            $room->update(['publication_status' => $decision]);

            $moderation = StoreModeration::create([
                'store_id' => $room->id,
                'status' => $decision,
                'reason_rejected' => $reason ?? '',
                'moderation_date' => now(),
            ]);

            $room->load('landlord.user');
            if ($room->landlord && $room->landlord->user) {
                NotificationService::send(
                    $adminId,
                    $room->landlord->user->id,
                    $decision === 'approved' ? NotificationType::STORE_APPROVED : NotificationType::STORE_REJECTED,
                    $decision === 'approved' ? 'Bodega aprobada' : 'Bodega rechazada',
                    $decision === 'approved'
                        ? 'Tu bodega fue aprobada y ya es visible en el catálogo.'
                        : ($reason ?? 'Tu bodega fue rechazada.'),
                    [
                        'store_room_id' => $room->id,
                        'moderation_id' => $moderation->id,
                    ]
                );
            }

            return $moderation;
        });
    }
}
