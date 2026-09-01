<?php

namespace App\Http\Requests;

/**
 * Bolsa de reglas, no FormRequest — ver StoreAdminRequest para la explicación
 * completa de por qué no se inyecta como type-hint.
 */
class UpdateCancelationsPolicesRequest
{
    public function rules(): array
    {
        return [
            'landlord_id' => 'sometimes|required|exists:landlords,id',
            'policy_name' => 'sometimes|required|string|max:100',
            'description' => 'sometimes|required|string|max:1000',
            'is_default' => 'sometimes|required|boolean',
        ];
    }
}
