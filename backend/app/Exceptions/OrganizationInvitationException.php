<?php

namespace App\Exceptions;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use RuntimeException;

/**
 * A revoke that cannot proceed: the invitation is not in this organization
 * (404) or it is no longer pending (409). Both bodies are a bare message.
 */
class OrganizationInvitationException extends RuntimeException
{
    public const NOT_FOUND_MESSAGE = 'Invitación no encontrada';

    public const UNAVAILABLE_MESSAGE = 'Esta invitación ya no está disponible';

    private function __construct(string $message, private int $status)
    {
        parent::__construct($message);
    }

    public static function notFound(): self
    {
        return new self(self::NOT_FOUND_MESSAGE, 404);
    }

    public static function unavailable(): self
    {
        return new self(self::UNAVAILABLE_MESSAGE, 409);
    }

    public function render(Request $request): JsonResponse
    {
        return response()->json(['message' => $this->getMessage()], $this->status);
    }
}
