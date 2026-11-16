<?php

namespace App\Policies;

use App\Enums\OrganizationRole;
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

    /**
     * sdd/tenant-self-cancel: identity-only check for the tenant-initiated
     * cancel and preview path (eligibility is ReservationService's job).
     * HUE-06 OR-13/OR-17: an organization reservation is decided by the
     * caller's live pivot role in THAT organization (admin only, never the
     * header or the creator); a personal one stays owner-only.
     */
    public function cancelAsTenant(User $user, Reservations $reservation): bool
    {
        if ($reservation->organization_id !== null) {
            return $user->roleInOrganization($reservation->organization_id) === OrganizationRole::ADMIN;
        }

        return $this->ownsAsTenant($user, $reservation);
    }

    /**
     * sdd/huc05-payment-receipt: only the owning tenant may download the
     * payment receipt. Identity only -- whether a receipt exists is the
     * controller's job (ReservationReceipt::build() === null -> 404).
     */
    public function viewReceipt(User $user, Reservations $reservation): bool
    {
        return $this->ownsAsTenant($user, $reservation);
    }

    private function ownsAsTenant(User $user, Reservations $reservation): bool
    {
        $reservation->loadMissing('tenants');

        return $reservation->tenants !== null && $reservation->tenants->user_id === $user->id;
    }
}
