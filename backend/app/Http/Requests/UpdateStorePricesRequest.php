<?php

namespace App\Http\Requests;

/**
 * Bolsa de reglas, no FormRequest — ver StoreAdminRequest para la explicación
 * completa de por qué no se inyecta como type-hint.
 */
class UpdateStorePricesRequest
{
    public function rules(): array
    {
        return [
            'store_room_id' => 'exists:storeRooms,id',
            'mode' => 'in:day,month,year',
            'price' => 'numeric|min:0.5',
            'disponibility' => 'boolean',
        ];
    }
}
