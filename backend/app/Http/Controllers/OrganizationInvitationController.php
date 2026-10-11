<?php

namespace App\Http\Controllers;

use App\Enums\OrganizationRole;
use App\Http\Middleware\ResolveActiveOrganization;
use App\Http\Requests\InviteMemberRequest;
use App\Models\Organization;
use Illuminate\Http\Exceptions\HttpResponseException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Invitations of one organization (hue-01 INV-2). Like the wallet and
 * spending-limit controllers, the organization comes from the URL path and
 * the caller's role is read from the organization_user pivot; `org.context`
 * is deliberately not mounted, so the X-Organization-Id header plays no role.
 * `{organization}` is a raw id (no model binding).
 */
class OrganizationInvitationController extends Controller
{
    public function store(InviteMemberRequest $request): JsonResponse
    {
        // Interim shell: only authorization and validation are wired (U1a-1).
        return response()->json(['message' => 'No implementado'], 501);
    }

    public function index(Request $request, string $organization): JsonResponse
    {
        $this->adminOrFail($request, $organization);

        // Interim shell: the paginated list arrives with INV-9.
        return response()->json(['data' => []]);
    }

    /**
     * Same two denials as InviteMemberRequest: a non-member (or a missing
     * organization) and a member who is not an admin.
     */
    private function adminOrFail(Request $request, string $organizationId): Organization
    {
        $organization = $request->user()->organizations()->whereKey((int) $organizationId)->first();

        if (! $organization) {
            $this->deny(ResolveActiveOrganization::FORBIDDEN_MESSAGE);
        }

        if ($organization->pivot->role !== OrganizationRole::ADMIN->value) {
            $this->deny(InviteMemberRequest::NOT_ADMIN_MESSAGE);
        }

        return $organization;
    }

    private function deny(string $message): never
    {
        throw new HttpResponseException(response()->json(['message' => $message], 403));
    }
}
