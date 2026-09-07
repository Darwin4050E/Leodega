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

    /**
     * Only the landlord who owns the storeroom may edit its listing
     * (HUG-08). Same shape as delete(): receives $landlord already
     * resolved so the controller can tell "no landlord profile" (404)
     * apart from "not the owner" (403).
     *
     * @SuppressWarnings(PHPMD.UnusedFormalParameter)
     */
    public function update(User $user, StoreRooms $room, Landlords $landlord): bool
    {
        return $room->landlord_id === $landlord->id;
    }

    /**
     * Ownership ONLY (spec #175 "store-room-resubmission", design decision
     * #5). The "room is not currently rejected" precondition is a SEPARATE
     * state-conflict check that lives in StoreRoomService::resubmit() and
     * throws StoreRoomResubmissionException::conflict() (409) — it must
     * NEVER be folded into this policy, so SDD 3's UI can distinguish "you
     * cannot touch this listing" (403) from "nothing to resubmit" (409).
     *
     * @SuppressWarnings(PHPMD.UnusedFormalParameter)
     */
    public function resubmit(User $user, StoreRooms $room, Landlords $landlord): bool
    {
        return $room->landlord_id === $landlord->id;
    }
}
