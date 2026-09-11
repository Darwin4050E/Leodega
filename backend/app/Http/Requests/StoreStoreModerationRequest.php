<?php

namespace App\Http\Requests;

/**
 * Bolsa de reglas, no FormRequest — ver StoreAdminRequest para la explicación
 * completa de por qué no se inyecta como type-hint.
 */
class StoreStoreModerationRequest
{
    /**
     * @param  string|null  $decision  approved/rejected/pending, passed by the caller
     *                                 after peeking the raw payload so the shared
     *                                 ModerationDecisionRules bag can branch on it
     *                                 before validation runs.
     * @param  bool  $permitMissing  whether the target store room has no
     *                               firefighter permit attached.
     */
    public function rules(?string $decision = null, bool $permitMissing = false): array
    {
        return array_merge([
            'store_id' => 'required|exists:storeRooms,id',
            'status' => 'required|in:pending,approved,rejected',
            'moderation_date' => 'sometimes|date',
        ], (new ModerationDecisionRules)->rules($decision ?? 'pending', $permitMissing));
    }
}
