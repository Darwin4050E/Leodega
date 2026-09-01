<?php

namespace App\Http\Requests;

/**
 * Bolsa de reglas, no FormRequest — ver StoreAdminRequest para la explicación
 * completa de por qué no se inyecta como type-hint.
 */
class StoreLandlordRequest
{
    public function rules(): array
    {
        return [
            'user_id' => 'required|exists:user,id',
            'optional_company' => 'sometimes|string|max:500|nullable',
        ];
    }
}
