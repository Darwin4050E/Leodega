<?php

namespace App\Exceptions;

use RuntimeException;

/**
 * Raised by ReservationPricingService::quote() when no eligible
 * (mode='month', disponibility=true) store_prices row exists for the
 * requested storeroom.
 */
class ReservationPricingException extends RuntimeException
{
    //
}
