<?php

namespace App\Http\Requests;

/**
 * Bolsa de reglas, no FormRequest — ver StoreAdminRequest para la explicación
 * completa de por qué no se inyecta como type-hint. Aquí el controlador ni
 * siquiera pasa por ApiController, pero igual arma el 400 a mano con
 * Validator::make(); se conserva ese mismo patrón.
 */
class StoreStorePhotoRequest
{
    public function rules(): array
    {
        return [
            'photos' => 'required|array|min:1',
            'photos.*' => 'image|mimes:jpg,jpeg,png,webp|max:2048',
        ];
    }
}
