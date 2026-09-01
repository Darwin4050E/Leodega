<?php

namespace App\Http\Requests;

/**
 * Bolsa de reglas, no FormRequest — ver StoreAdminRequest para la explicación
 * completa de por qué no se inyecta como type-hint. A diferencia de las demás,
 * necesita el id del usuario en edición para las reglas "unique...ignore".
 */
class UpdateUserRequest
{
    public function __construct(private readonly int|string $userId) {}

    public function rules(): array
    {
        return [
            'name' => 'sometimes|required|string|max:255',
            'lastname' => 'sometimes|required|string|max:255',
            'email' => 'sometimes|required|string|email|max:255|unique:user,email,'.$this->userId,
            'phone' => 'sometimes|required|string|unique:user,phone,'.$this->userId.'|max:10',
            'password' => 'sometimes|required|string|min:8',
            'role' => 'sometimes|in:admin,landlord,tenant',
            'start_date' => 'sometimes|date|nullable',
            'state' => 'sometimes|in:active,blocked,pending',
            'enable_messages' => 'sometimes|boolean',
        ];
    }
}
