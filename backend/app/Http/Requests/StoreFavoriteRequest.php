<?php

namespace App\Http\Requests;

/**
 * Bolsa de reglas, no FormRequest — ver StoreAdminRequest para la explicación
 * completa de por qué no se inyecta como type-hint.
 *
 * BUG corregido: el campo validado era `store_id`, pero la columna real (y el
 * $fillable de App\Models\Favorites) es `store_room_id`. Como
 * ApiController::storeModel hace `$modelClass::create($validated)`, el valor
 * validado nunca llegaba a guardarse en la columna correcta y la creación
 * fallaba siempre con un 500 por violación de NOT NULL. Sin consumidor real
 * en el frontend (grep exhaustivo, cero referencias a /favorites), se corrige
 * el nombre del campo para que coincida con la columna real.
 */
class StoreFavoriteRequest
{
    public function rules(): array
    {
        return [
            'user_id' => 'required|exists:user,id',
            'store_room_id' => 'required|exists:storeRooms,id',
            'save_date' => 'date',
        ];
    }
}
