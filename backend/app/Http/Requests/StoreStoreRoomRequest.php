<?php

namespace App\Http\Requests;

/**
 * Bolsa de reglas, no FormRequest — ver StoreAdminRequest para la explicación
 * completa de por qué no se inyecta como type-hint.
 */
class StoreStoreRoomRequest
{
    public function rules(): array
    {
        return [
            'landlord_id' => 'required|exists:landlords,id',
            'room_type' => 'required|in:habitacion,garaje,contenedor,sotano,atico,bodega',
            'storage_type' => 'required|in:completa,privado,compartido',
            'direction' => 'required|string',
            'city' => 'required|string',
            'size' => 'required|numeric',
            'title' => 'required|string',
            'description' => 'required|string',
            'security' => 'required|string',
            'publication_status' => 'in:pending,approved,rejected',
            'publication_date' => 'date',
        ];
    }
}
