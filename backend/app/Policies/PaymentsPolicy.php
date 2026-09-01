<?php

namespace App\Policies;

use App\Models\Reservations;
use App\Models\User;

/**
 * Corrección de inconsistencia (ver PLAN_CORRECCION_INCONSISTENCIAS.md, Fase 2.2):
 * antes, /payments solo exigía auth.api:sanctum -- cualquier usuario autenticado
 * podía registrar un pago para la reserva de otro. Solo el tenant dueño de la
 * reserva puede registrar un pago sobre ella.
 */
class PaymentsPolicy
{
    public function create(User $user, Reservations $reservation): bool
    {
        $reservation->loadMissing('tenants');

        return $reservation->tenants !== null && $reservation->tenants->user_id === $user->id;
    }
}
