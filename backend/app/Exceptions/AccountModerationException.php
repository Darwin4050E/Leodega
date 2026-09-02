<?php

namespace App\Exceptions;

use RuntimeException;

/**
 * Un solo tipo de excepción para los rechazos de AccountModerationService,
 * llevando el status HTTP que el controlador debe responder. Se colapsan aquí
 * los casos "denied" (403 — self-target / target admin) y "conflict"
 * (409 — la cuenta ya está en el estado solicitado), tal como habilita el
 * diseño de HUA-03.
 */
class AccountModerationException extends RuntimeException
{
    private function __construct(string $message, public readonly int $statusCode)
    {
        parent::__construct($message);
    }

    public static function denied(string $message): self
    {
        return new self($message, 403);
    }

    public static function conflict(string $message): self
    {
        return new self($message, 409);
    }
}
