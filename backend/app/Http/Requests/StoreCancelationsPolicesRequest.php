<?php

namespace App\Http\Requests;

/**
 * Bolsa de reglas, no FormRequest — ver StoreAdminRequest para la explicación
 * completa de por qué no se inyecta como type-hint.
 */
class StoreCancelationsPolicesRequest
{
    public function rules(): array
    {
        return [
            'landlord_id' => 'required|exists:landlords,id',
            'policy_name' => 'required|string|max:100',
            'description' => 'required|string|max:1000',
            'is_default' => 'required|boolean',
        ];
    }
}
