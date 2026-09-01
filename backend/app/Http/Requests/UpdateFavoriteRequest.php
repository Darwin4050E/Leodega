<?php

namespace App\Http\Requests;

/**
 * Bolsa de reglas, no FormRequest — ver StoreAdminRequest para la explicación
 * completa de por qué no se inyecta como type-hint.
 */
class UpdateFavoriteRequest
{
    public function rules(): array
    {
        return [
            'user_id' => 'sometimes|required|exists:user,id',
            'store_room_id' => 'sometimes|required|exists:storeRooms,id',
            'save_date' => 'sometimes|required|date',
        ];
    }
}
