<?php

namespace App\Http\Requests;

/**
 * Bolsa de reglas, no FormRequest — ver StoreAdminRequest para la explicación
 * completa de por qué no se inyecta como type-hint.
 *
 * Nota: se conservan tal cual los valores de "in:" del controlador original,
 * incluyendo los typos existentes ("atico, bodega" con espacio, "complet" en
 * vez de "completa") — no es objeto de esta fase corregirlos.
 */
class UpdateStoreRoomRequest
{
    public function rules(): array
    {
        return [
            'landlord_id' => 'exists:landlords,id',
            'room_type' => 'in:habitacion,garaje,contenedor,sotano,atico, bodega',
            'storage_type' => 'in:complet,privado,compartido',
            'direction' => 'string',
            'city' => 'string',
            'size' => 'numeric',
            'title' => 'string',
            'description' => 'string',
            'security' => 'string',
            'publication_status' => 'in:pending,approved,rejected',
            'publication_date' => 'date',
        ];
    }
}
