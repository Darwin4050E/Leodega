<?php

namespace App\Http\Requests;

/**
 * Bolsa de reglas, no FormRequest — ver StoreAdminRequest para la explicación
 * completa de por qué no se inyecta como type-hint.
 *
 * Nota: a diferencia de otros Update*, el controlador original no usa
 * "sometimes" aquí — todos los campos son requeridos también al actualizar.
 * Se conserva tal cual.
 */
class UpdateStoreDisponibilityRequest
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
