<?php

namespace App\Http\Controllers;

use App\Enums\OrganizationRole;
use App\Http\Middleware\ResolveActiveOrganization;
use App\Http\Requests\InviteMemberRequest;
use App\Http\Resources\InvitationResource;
use App\Models\Organization;
use App\Services\OrganizationInvitationService;
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
    private const PER_PAGE = 20;

    public function store(InviteMemberRequest $request, OrganizationInvitationService $invitations): JsonResponse
    {
        $invitation = $invitations->invite($request->organization(), $request->user(), $request->validated('email'));

        return response()->json((new InvitationResource($invitation))->resolve(), 201);
    }

    public function index(Request $request, string $organization): JsonResponse
    {
        $organization = $this->adminOrFail($request, $organization);

        $invitations = $organization->invitations()
            ->with('inviter:id,name')
            ->orderByDesc('created_at')
            ->orderByDesc('id')
            ->paginate(self::PER_PAGE)
            ->through(fn ($invitation) => (new InvitationResource($invitation))->resolve());

        // The page rows cannot give the header counter, so the whole
        // organization's effective-pending count travels with the paginator.
        return response()->json($invitations->toArray() + [
            'pending_count' => $organization->invitations()->pending()->count(),
        ]);
    }

    /**
     * Admin check first, so a member never learns whether an id exists.
     */
    public function destroy(Request $request, OrganizationInvitationService $invitations, string $organization, string $invitation): JsonResponse
    {
        $organization = $this->adminOrFail($request, $organization);

        return response()->json((new InvitationResource($invitations->revoke($organization, (int) $invitation)))->resolve());
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
