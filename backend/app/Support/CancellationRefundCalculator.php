<?php

namespace App\Support;

use Carbon\Carbon;

/**
 * Pure, static tier-to-percentage refund math for tenant self-cancellation
 * (sdd/tenant-self-cancel). Mirrors the `App\Support\ReservationCode` pattern
 * — no DI, one static entry point, no side effects.
 *
 * Reads the reservation's SNAPSHOTTED `cancellation_policy_tier`, never the
 * storeroom's current tier (decision #339): a landlord changing their
 * storeroom's tier after a reservation was booked must never change what a
 * paying customer gets back.
 *
 * Threshold table, higher-percentage side wins the boundary (>=, not >):
 *
 *   flexible: 100% while daysBeforeStart >= 1, else 0%
 *   moderada: 100% while daysBeforeStart >= 7, 50% while daysBeforeStart >= 1, else 0%
 *   estricta: 50% while daysBeforeStart >= 14, else 0%
 *
 * An unrecognized tier conservatively resolves to 0% — no rule to apply.
 */
class CancellationRefundCalculator
{
    /**
     * @var array<string, array<int, array{0: int, 1: float}>>
     *
     * Each tier lists [daysThreshold, percentage] pairs sorted by threshold
     * descending. The first threshold the reservation still meets wins.
     */
    private const TIER_RULES = [
        'flexible' => [[1, 1.0]],
        'moderada' => [[7, 1.0], [1, 0.5]],
        'estricta' => [[14, 0.5]],
    ];

    /**
     * @return string decimal amount, e.g. "50.00", formatted to 2 decimals
     */
    public static function compute(string $tier, string $startDate, string $totalMount): string
    {
        $percentage = self::percentageFor($tier, $startDate);

        $totalCents = (int) round(((float) $totalMount) * 100);
        $refundCents = (int) round($totalCents * $percentage);

        return number_format($refundCents / 100, 2, '.', '');
    }

    private static function percentageFor(string $tier, string $startDate): float
    {
        $rules = self::TIER_RULES[$tier] ?? null;

        if ($rules === null) {
            return 0.0;
        }

        $daysBeforeStart = Carbon::today()->diffInDays(Carbon::parse($startDate)->startOfDay(), false);

        foreach ($rules as [$threshold, $rate]) {
            if ($daysBeforeStart >= $threshold) {
                return $rate;
            }
        }

        return 0.0;
    }
}
