<?php

namespace App\Http\Requests;

/**
 * Bolsa de reglas, no FormRequest — ver StoreAdminRequest para la explicación
 * completa de por qué no se inyecta como type-hint.
 */
class UpdateAdminRequest
{
    public function rules(): array
    {
        return [
            'user_id' => 'sometimes|required|exists:user,id',
            'admin_level' => 'sometimes|required|integer|min:1|max:2',
        ];
    }
}
