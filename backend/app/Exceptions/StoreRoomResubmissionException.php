<?php

namespace App\Exceptions;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use RuntimeException;

/**
 * Carries the 409 conflict for StoreRoomService::resubmit() when the room
 * is not currently `rejected` (design decision #5). Ownership's 403 is
 * already fully handled by Gate::authorize('resubmit', ...) throwing
 * Laravel's own AuthorizationException, so unlike AccountModerationException
 * this carries only a conflict() factory — there is no second "denied" case.
 */
class StoreRoomResubmissionException extends RuntimeException
{
    private function __construct(string $message, public readonly int $statusCode)
    {
        parent::__construct($message);
    }

    public static function conflict(string $message): self
    {
        return new self($message, 409);
    }

    public function render(Request $request): JsonResponse
    {
        return response()->json(['message' => $this->getMessage()], $this->statusCode);
    }
}
