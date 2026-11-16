<?php

namespace App\Exceptions;

use Illuminate\Validation\ValidationException;

/**
 * A debit would take the organization wallet below zero (OW-6). Extends
 * ValidationException so it renders as a 422 `{message, errors: {wallet}}`
 * through the existing handler, with no extra render path.
 */
class InsufficientWalletBalanceException extends ValidationException
{
    public const MESSAGE = 'Saldo insuficiente en la organización';

    public static function make(): static
    {
        return static::withMessages(['wallet' => [self::MESSAGE]]);
    }
}
