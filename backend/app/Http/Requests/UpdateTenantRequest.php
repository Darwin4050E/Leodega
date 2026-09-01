<?php

namespace App\Http\Requests;

/**
 * Bolsa de reglas, no FormRequest — ver StoreAdminRequest para la explicación
 * completa de por qué no se inyecta como type-hint.
 */
class UpdateTenantRequest
{
    public function rules(): array
    {
        return [
            'search_preference' => 'sometimes|required|string',
            'user_id' => 'sometimes|required|exists:user,id',
        ];
    }
}
