<?php

namespace App\Http\Requests;

/**
 * Bolsa de reglas, no FormRequest — ver StoreAdminRequest para la explicación
 * completa de por qué no se inyecta como type-hint.
 */
class StoreUserRequest
{
    public function rules(): array
    {
        return [
            'name' => 'required|string|max:255',
            'lastname' => 'required|string|max:255',
            'email' => 'required|string|email|max:255|unique:user',
            'phone' => 'required|string|unique:user|max:10',
            'password' => 'required|string|min:8',
            'role' => 'in:admin,landlord,tenant',
            'start_date' => 'date|default:now()',
            'state' => 'in:active,blocked,pending',
            'enable_messages' => 'required|boolean',
        ];
    }
}
