<?php

namespace App\Exceptions;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use RuntimeException;

/**
 * Raised by ReservationPricingService::quote() when no eligible
 * (mode='month', disponibility=true) store_prices row exists for the
 * requested storeroom.
 */
class ReservationPricingException extends RuntimeException
{
    public function render(Request $request): JsonResponse
    {
        return response()->json(['message' => $this->getMessage()], 422);
    }
}
