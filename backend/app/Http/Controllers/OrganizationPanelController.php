<?php

namespace App\Http\Controllers;

use App\Enums\OrganizationRole;
use App\Http\Middleware\ResolveActiveOrganization;
use App\Http\Resources\PanelMemberResource;
use App\Http\Resources\PanelReservationResource;
use App\Models\Organization;
use App\Services\OrganizationPanelService;
use Illuminate\Http\Exceptions\HttpResponseException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Read-only organization control panel (hue-03 PAN-1..PAN-4). Like the wallet,
 * spending-limit and invitation controllers, the organization comes from the
 * URL path and membership is checked against the organization_user pivot;
 * `org.context` is deliberately not mounted, so the X-Organization-Id header
 * plays no role. `{organization}` is a raw id (no model binding), so a
 * non-member and a nonexistent organization get the same 403.
 */
class OrganizationPanelController extends Controller
{
    public function summary(Request $request, OrganizationPanelService $panel, string $organization): JsonResponse
    {
        $organization = $this->memberOrFail($request, $organization);

        return response()->json($panel->summary($organization, $request->user(), $this->isAdmin($organization)));
    }

    /**
     * Bare array on purpose (repo list convention, no envelope).
     */
    public function members(Request $request, OrganizationPanelService $panel, string $organization): JsonResponse
    {
        $organization = $this->memberOrFail($request, $organization);

        return response()->json(
            PanelMemberResource::collection($panel->members($organization, $request->user(), $this->isAdmin($organization)))->resolve()
        );
    }

    /**
     * Flat paginator, 20 per page, like the invitations list.
     */
    public function reservations(Request $request, OrganizationPanelService $panel, string $organization): JsonResponse
    {
        $organization = $this->memberOrFail($request, $organization);

        return response()->json(
            $panel->reservations($organization, $request->user(), $this->isAdmin($organization))
                ->through(fn (array $row) => (new PanelReservationResource($row))->resolve())
                ->toArray()
        );
    }

    private function memberOrFail(Request $request, string $organizationId): Organization
    {
        $organization = $request->user()->organizations()->whereKey((int) $organizationId)->first();

        if (! $organization) {
            throw new HttpResponseException(
                response()->json(['message' => ResolveActiveOrganization::FORBIDDEN_MESSAGE], 403)
            );
        }

        return $organization;
    }

    private function isAdmin(Organization $organization): bool
    {
        return $organization->pivot->role === OrganizationRole::ADMIN->value;
    }
}
