<?php

namespace App\Policies;

use App\Models\Landlords;
use App\Models\Reservations;
use App\Models\User;

class ReservationsPolicy
{
    /**
     * Ownership-only check for HUG-06 gestor cancellation, matching the
     * storerooms-deletion precedent: the policy decides identity, the
     * service (ReservationService::cancelByLandlord) decides eligibility
     * and raises ReservationConflictException.
     *
     * Recibe $landlord ya resuelto (en vez de buscarlo aquí adentro) porque
     * el controlador necesita distinguir "no tienes perfil de landlord"
     * (404, vía firstOrFail) de "no eres el dueño de esta bodega" (403, la
     * autorización real) — son dos fallos distintos con distinto status hoy.
     *
     * $user no se usa: Laravel exige que sea el primer parámetro de todo
     * método de Policy para poder resolverlo, aunque esta regla en particular
     * no lo necesite (la identidad ya quedó resuelta en $landlord).
     *
     * @SuppressWarnings(PHPMD.UnusedFormalParameter)
     */
    public function cancel(User $user, Reservations $reservation, Landlords $landlord): bool
    {
        return $reservation->storeRooms->landlord_id === $landlord->id;
    }
}
