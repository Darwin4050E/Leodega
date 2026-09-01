<?php

namespace App\Http\Requests;

/**
 * Bolsa de reglas, no FormRequest — ver StoreAdminRequest para la explicación
 * completa de por qué no se inyecta como type-hint.
 */
class StoreStoreDisponibilityRequest
{
    public function rules(): array
    {
        return [
            'store_id' => 'required|exists:storeRooms,id',
            'start_date' => 'required|date',
            'end_date' => 'required|date|after_or_equal:start_date',
        ];
    }
}
