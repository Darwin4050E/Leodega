<?php

namespace App\Http\Requests;

/**
 * Bolsa de reglas, no FormRequest — ver StoreAdminRequest para la explicación
 * completa de por qué no se inyecta como type-hint.
 */
class UpdateStoreModerationRequest
{
    public function rules(): array
    {
        return [
            'store_id' => 'sometimes|exists:storeRooms,id',
            'status' => 'sometimes|in:pending,approved,rejected',
            'reason_rejected' => 'required|string',
            'moderation_date' => 'sometimes|date',
        ];
    }
}
