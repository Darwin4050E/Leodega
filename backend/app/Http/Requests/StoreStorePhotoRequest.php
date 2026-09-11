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
            'photos' => 'required|array|min:3',
            'photos.*' => 'image|mimes:jpg,jpeg,png,webp|max:2048',
        ];
    }

    public function messages(): array
    {
        return [
            'photos.required' => 'Debe adjuntar al menos 3 fotos de la bodega.',
            'photos.min' => 'Debe adjuntar al menos 3 fotos de la bodega.',
            'photos.*.image' => 'Cada archivo debe ser una imagen.',
            'photos.*.mimes' => 'Las fotos deben ser JPG, JPEG, PNG o WEBP.',
            'photos.*.max' => 'Cada foto no debe superar los 2 MB.',
        ];
    }
}
