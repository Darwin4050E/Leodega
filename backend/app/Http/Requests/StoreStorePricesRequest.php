<?php

namespace App\Http\Requests;

/**
 * Bolsa de reglas, no FormRequest — ver StoreAdminRequest para la explicación
 * completa de por qué no se inyecta como type-hint.
 */
class StoreStorePricesRequest
{
    public function rules(): array
    {
        return [
            'store_room_id' => 'required|exists:storeRooms,id',
            'mode' => 'required|in:day,month,year',
            'price' => 'required|numeric|min:0.5',
            'disponibility' => 'boolean',
        ];
    }
}
