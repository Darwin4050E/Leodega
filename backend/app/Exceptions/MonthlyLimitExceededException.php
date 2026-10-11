<?php

namespace App\Exceptions;

use Illuminate\Validation\ValidationException;

/**
 * A wallet booking would take a member past their monthly limit (ML-3).
 * Extends ValidationException so it renders as a 422
 * `{message, errors: {monthly_limit}}` through the existing handler, with no
 * extra render path. The message is static: no amounts are interpolated.
 */
class MonthlyLimitExceededException extends ValidationException
{
    public const MESSAGE = 'Esta reserva supera tu límite mensual. Pide a un administrador que lo aumente.';

    public static function make(): static
    {
        return static::withMessages(['monthly_limit' => [self::MESSAGE]]);
    }
}
