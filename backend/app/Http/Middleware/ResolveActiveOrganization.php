<?php

namespace App\Http\Middleware;

use App\Enums\OrganizationRole;
use App\Support\ActiveContext;
use Closure;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Resolves the active organization from the X-Organization-Id header and
 * exposes it through two request attributes (read them via ActiveContext).
 * Absent, empty or whitespace-only header means the personal context; any
 * other value must be a canonical id of an organization the caller belongs to.
 * Mount it after `auth.api:sanctum` (and `role:tenant` where it applies); it
 * checks membership only and is role-agnostic.
 */
class ResolveActiveOrganization
{
    public const HEADER = 'X-Organization-Id';

    public const FORBIDDEN_MESSAGE = 'No perteneces a la organización seleccionada';

    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if (! $user) {
            return response()->json(['message' => 'Unauthenticated.'], 401);
        }

        // all(), never header(): header() returns only the first value and
        // would hide a request that carries the header more than once.
        $values = $request->headers->all(self::HEADER);

        if ($values === []) {
            return $this->personal($request, $next);
        }

        if (count($values) > 1) {
            return $this->forbidden();
        }

        $raw = trim((string) $values[0]);

        if ($raw === '') {
            return $this->personal($request, $next);
        }

        // Canonical positive decimal only. The cast round-trip rejects values
        // beyond 64 bits: an overflowing (int) cast saturates at PHP_INT_MAX,
        // so its string no longer equals the input. The value is never echoed.
        if (! preg_match('/^[1-9][0-9]*$/', $raw) || (string) (int) $raw !== $raw) {
            return $this->forbidden();
        }

        // One query proves membership and loads the caller's own pivot role.
        $organization = $user->organizations()->whereKey((int) $raw)->first();

        if (! $organization) {
            return $this->forbidden();
        }

        // An invalid stored role is data corruption: from() throws (500)
        // rather than silently degrading the request to personal.
        $request->attributes->set(ActiveContext::ORGANIZATION_ATTRIBUTE, $organization);
        $request->attributes->set(ActiveContext::ROLE_ATTRIBUTE, OrganizationRole::from($organization->pivot->role));

        return $next($request);
    }

    private function personal(Request $request, Closure $next): Response
    {
        $request->attributes->set(ActiveContext::ORGANIZATION_ATTRIBUTE, null);
        $request->attributes->set(ActiveContext::ROLE_ATTRIBUTE, null);

        return $next($request);
    }

    private function forbidden(): JsonResponse
    {
        return response()->json(['message' => self::FORBIDDEN_MESSAGE], 403);
    }
}
