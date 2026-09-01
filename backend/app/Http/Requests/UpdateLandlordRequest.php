<?php

namespace App\Http\Requests;

/**
 * Bolsa de reglas, no FormRequest — ver StoreAdminRequest para la explicación
 * completa de por qué no se inyecta como type-hint.
 */
class UpdateLandlordRequest
{
    public function rules(): array
    {
        return [
            'user_id' => 'sometimes|required|exists:user,id',
            'optional_company' => 'sometimes|required|string|max:500|nullable',
        ];
    }
}
