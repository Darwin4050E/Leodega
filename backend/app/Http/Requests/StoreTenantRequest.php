<?php

namespace App\Http\Requests;

/**
 * Bolsa de reglas, no FormRequest — ver StoreAdminRequest para la explicación
 * completa de por qué no se inyecta como type-hint.
 */
class StoreTenantRequest
{
    public function rules(): array
    {
        return [
            'search_preference' => 'required|string',
            'user_id' => 'required|exists:user,id',
        ];
    }
}
