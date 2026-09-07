<?php

namespace App\Http\Requests;

/**
 * Bolsa de reglas compartida por AMBOS puntos de entrada de moderación
 * (StoreRoomsController::update() y StoreModerationController::store()),
 * para eliminar el riesgo de drift entre dos implementaciones separadas de
 * la misma regla (decisión #172.4). No es un FormRequest — ver
 * StoreAdminRequest para la explicación completa de por qué no se inyecta
 * como type-hint.
 */
class ModerationDecisionRules
{
    public function rules(string $decision, bool $permitMissing): array
    {
        $rejecting = $decision === 'rejected';
        $needsWaiver = $decision === 'approved' && $permitMissing;

        return [
            'reason_code' => $rejecting ? 'required|in:fotos,info,permiso,otro' : 'nullable|in:fotos,info,permiso,otro',
            'reason_rejected' => $rejecting ? 'required_if:reason_code,otro|nullable|string' : 'nullable|string',
            'permit_waiver_acknowledged' => $needsWaiver ? 'required|accepted' : 'sometimes|boolean',
        ];
    }
}
