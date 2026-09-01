<?php

namespace App\Services;

use App\Models\Landlords;
use App\Models\Tenants;
use App\Models\User;

class UserRegistrationService
{
    /**
     * Extraído de UserController::store: según el rol asignado al usuario
     * recién creado, da de alta automáticamente su perfil de Landlord o
     * Tenant. No hace nada si el rol es "admin" o no viene informado.
     */
    public function createProfileForRole(User $user): void
    {
        if ($user->role === 'landlord') {
            Landlords::create([
                'user_id' => $user->id,
                'optional_company' => null,
            ]);
        } elseif ($user->role === 'tenant') {
            Tenants::create([
                'user_id' => $user->id,
                'search_preference' => '',
            ]);
        }
    }
}
