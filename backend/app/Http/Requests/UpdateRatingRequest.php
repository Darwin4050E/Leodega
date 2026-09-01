<?php

namespace App\Http\Requests;

/**
 * Bolsa de reglas, no FormRequest — ver StoreAdminRequest para la explicación
 * completa de por qué no se inyecta como type-hint.
 */
class UpdateRatingRequest
{
    public function rules(): array
    {
        return [
            'store_id' => 'sometimes|exists:storeRooms,id',
            'stars' => 'sometimes|integer|between:1,5',
            'comment' => 'sometimes|string',
        ];
    }
}
