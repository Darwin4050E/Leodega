<?php

namespace App\Policies;

use App\Models\Landlords;
use App\Models\StoreRooms;
use App\Models\User;

class StoreRoomsPolicy
{
    /**
     * Only the landlord who owns the storeroom may delete it.
     *
     * Receives $landlord already resolved (instead of looking it up here)
     * so the controller can distinguish "no landlord profile" (404, via
     * firstOrFail) from "not the owner of this storeroom" (403, the actual
     * authorization) — mirrors ReservationsPolicy::updateStatus.
     *
     * $user is unused: Laravel requires it as the first parameter of every
     * Policy method to resolve it, even though this rule does not need it
     * (identity is already resolved in $landlord).
     *
     * @SuppressWarnings(PHPMD.UnusedFormalParameter)
     */
    public function delete(User $user, StoreRooms $room, Landlords $landlord): bool
    {
        return $room->landlord_id === $landlord->id;
    }
}
