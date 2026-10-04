<?php

namespace App\Support;

/**
 * Single canonical definition of the reservation code shown to customers.
 * MUST stay byte-identical to the frontend counterpart
 * `frontend/src/utils/reservationCode.ts` (Slice A) so the on-screen
 * receipt and this email never disagree on the code for the same
 * reservation id.
 */
class ReservationCode
{
    public static function format(int $id): string
    {
        return sprintf('LEO-%06d', $id);
    }
}
