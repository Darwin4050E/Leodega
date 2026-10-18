<?php

namespace App\Exceptions;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use RuntimeException;

/**
 * An invitation action that cannot proceed: the invitation is not reachable by
 * the caller (404), it is no longer open (409 unavailable) or the invitee
 * already answered it (409 already responded). Every body is a bare message.
 */
class OrganizationInvitationException extends RuntimeException
{
    public const NOT_FOUND_MESSAGE = 'Invitación no encontrada';

    public const UNAVAILABLE_MESSAGE = 'Esta invitación ya no está disponible';

    public const ALREADY_RESPONDED_MESSAGE = 'Ya respondiste esta invitación';

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

    public static function alreadyResponded(): self
    {
        return new self(self::ALREADY_RESPONDED_MESSAGE, 409);
    }

    public function render(Request $request): JsonResponse
    {
        return response()->json(['message' => $this->getMessage()], $this->status);
    }
}
