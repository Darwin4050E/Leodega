<?php

namespace App\Support;

use InvalidArgumentException;

/**
 * Pure, static decimal-string <-> integer-cents helpers for the organization
 * wallet (org-wallet OW-3). Same shape as `CancellationRefundCalculator`: no
 * DI, no side effects. Wallet math runs on integer cents and amounts travel
 * as 2-decimal strings, so no binary float ever decides a balance.
 *
 * Rounding is half away from zero on the THIRD decimal, applied to the digits
 * themselves. SQLite hands DECIMAL columns back as floats, so floats are
 * first formatted with `%.6F` (which absorbs the binary noise, e.g. 10.005
 * is stored as 10.00499999999999989) and then rounded on the string.
 */
class Money
{
    private const DECIMAL = '/^(-)?(\d+)(?:\.(\d+))?\z/';

    private const CLIENT_AMOUNT = '/^\d+(\.\d{1,2})?\z/';

    /**
     * Lenient conversion for server-side amounts (stored balances, computed
     * refunds): rounds to cents instead of rejecting extra decimals.
     *
     * @throws InvalidArgumentException when the value is not a plain decimal
     */
    public static function toCents(string|int|float $amount): int
    {
        $text = is_float($amount) ? sprintf('%.6F', $amount) : (string) $amount;

        if (! preg_match(self::DECIMAL, $text, $parts)) {
            throw new InvalidArgumentException('Amount is not a plain decimal number.');
        }

        $decimals = str_pad($parts[3] ?? '', 3, '0');
        $cents = ((int) $parts[2]) * 100 + (int) substr($decimals, 0, 2);

        if ((int) $decimals[2] >= 5) {
            $cents++;
        }

        return $parts[1] === '-' ? -$cents : $cents;
    }

    /**
     * Strict conversion for client-supplied amounts: unsigned, at most 2
     * decimals. Extra decimals are rejected, never rounded (OW-3).
     *
     * @throws InvalidArgumentException
     */
    public static function parse(string $amount): int
    {
        if (! preg_match(self::CLIENT_AMOUNT, $amount)) {
            throw new InvalidArgumentException('Amount must be an unsigned decimal with at most 2 decimals.');
        }

        return self::toCents($amount);
    }

    /**
     * @return string decimal amount with exactly 2 decimals, e.g. "-40.00"
     */
    public static function fromCents(int $cents): string
    {
        $absolute = abs($cents);

        return sprintf('%s%d.%02d', $cents < 0 ? '-' : '', intdiv($absolute, 100), $absolute % 100);
    }
}
