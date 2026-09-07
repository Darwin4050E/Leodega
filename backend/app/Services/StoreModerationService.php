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
     * Human labels for the typed rejection reason, used ONLY to compose the
     * landlord notification body (design decision #4). NEVER exposed as an
     * API field: every resource keeps serving the raw `reason_code` value,
     * exactly like `cancellation_policy_tier` — the frontend renders its own
     * label.
     */
    private const REJECTION_REASON_LABELS = [
        'fotos' => 'Fotos incorrectas',
        'info' => 'Información incoherente',
        'permiso' => 'Permiso inválido',
        'otro' => 'Otro motivo',
    ];

    /**
     * @throws InvalidArgumentException si la decisión no es 'approved' ni 'rejected'.
     */
    public function moderate(StoreRooms $room, ModerationDecision $data): StoreModeration
    {
        if (! in_array($data->decision, ['approved', 'rejected'], true)) {
            throw new InvalidArgumentException("Decisión de moderación inválida: {$data->decision}");
        }

        $waiverAcknowledged = $data->decision === 'approved'
            && is_null($room->firefighter_permit_path)
            && $data->permitWaiverAcknowledged;

        return DB::transaction(function () use ($room, $data, $waiverAcknowledged) {
            $room->update(['publication_status' => $data->decision]);

            $moderation = StoreModeration::create([
                'store_id' => $room->id,
                'status' => $data->decision,
                'reason_rejected' => $data->reason ?? '',
                'reason_code' => $data->reasonCode,
                'admin_id' => $data->adminId,
                'permit_waived_at' => $waiverAcknowledged ? now() : null,
                'moderation_date' => now(),
            ]);

            $room->load('landlord.user');
            if ($room->landlord && $room->landlord->user) {
                NotificationService::send(
                    $data->adminId,
                    $room->landlord->user->id,
                    $data->decision === 'approved' ? NotificationType::STORE_APPROVED : NotificationType::STORE_REJECTED,
                    $data->decision === 'approved' ? 'Bodega aprobada' : 'Bodega rechazada',
                    $data->decision === 'approved'
                        ? 'Tu bodega fue aprobada y ya es visible en el catálogo.'
                        : $this->rejectionBody($data->reasonCode, $data->reason),
                    [
                        'store_room_id' => $room->id,
                        'moderation_id' => $moderation->id,
                    ]
                );
            }

            return $moderation;
        });
    }

    private function rejectionBody(?string $reasonCode, ?string $comment): string
    {
        $label = self::REJECTION_REASON_LABELS[$reasonCode] ?? null;
        if ($label === null) {
            // Legacy fallback for direct service calls with no typed code.
            return $comment ?: 'Tu bodega fue rechazada.';
        }

        return $comment ? "{$label}: {$comment}" : $label;
    }
}
