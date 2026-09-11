<?php

namespace App\Services;

use App\Exceptions\ReservationPricingException;
use App\Models\StorePrices;
use App\Models\StoreRooms;
use Carbon\Carbon;

/**
 * Stateless server-side pricing quote, called exactly once by
 * ReservationService::create() and never again: the result (rent subtotal,
 * service fee, deposit, total) is persisted as a snapshot and cancellation
 * reads it back instead of recomputing from live store_prices.
 *
 * All arithmetic is done in integer cents to avoid float drift, then
 * formatted back to "x.xx" decimal strings for storage in decimal(10,2)
 * columns.
 */
class ReservationPricingService
{
    private const SERVICE_FEE_RATE = 0.06;

    /**
     * @return array{rent_subtotal: string, service_fee: string, deposit: string, total_mount: string}
     *
     * @throws ReservationPricingException when no eligible (mode='month',
     *                                      disponibility=true) store_prices row exists for the room
     */
    public function quote(StoreRooms $room, string $startDate, string $endDate): array
    {
        $months = $this->monthsBetween($startDate, $endDate);

        $priceRow = StorePrices::where('store_room_id', $room->id)
            ->where('mode', 'month')
            ->where('disponibility', true)
            ->first();

        if (! $priceRow) {
            throw new ReservationPricingException(
                'No hay un precio mensual disponible para esta bodega.'
            );
        }

        $priceCents = (int) round(((float) $priceRow->price) * 100);

        $rentSubtotalCents = $priceCents * $months;
        $serviceFeeCents = (int) round($rentSubtotalCents * self::SERVICE_FEE_RATE);
        $depositCents = $priceCents;
        $totalCents = $rentSubtotalCents + $serviceFeeCents + $depositCents;

        return [
            'rent_subtotal' => $this->centsToDecimalString($rentSubtotalCents),
            'service_fee' => $this->centsToDecimalString($serviceFeeCents),
            'deposit' => $this->centsToDecimalString($depositCents),
            'total_mount' => $this->centsToDecimalString($totalCents),
        ];
    }

    /**
     * Floor whole months between the two dates, plus one extra month for
     * any started remainder (ceil-up on partial months); charging for any
     * started month is the intended billing convention. Never fewer than
     * one month.
     */
    private function monthsBetween(string $startDate, string $endDate): int
    {
        $start = Carbon::parse($startDate);
        $end = Carbon::parse($endDate);

        $fullMonths = $start->diffInMonths($end);
        $hasRemainder = $start->copy()->addMonths($fullMonths)->lt($end);

        return max(1, $fullMonths + ($hasRemainder ? 1 : 0));
    }

    private function centsToDecimalString(int $cents): string
    {
        return number_format($cents / 100, 2, '.', '');
    }
}
