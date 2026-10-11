<?php

namespace App\Http\Controllers;

use App\Enums\OrganizationRole;
use App\Http\Middleware\ResolveActiveOrganization;
use App\Http\Requests\SetSpendingLimitRequest;
use App\Http\Resources\SpendingLimitResource;
use App\Models\Organization;
use App\Services\SpendingLimitService;
use Illuminate\Http\Exceptions\HttpResponseException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Member spending limits of one organization (member-spending-limit ML-13,
 * ML-14). Like OrganizationWalletController, the organization comes from the
 * URL path and membership is checked against the organization_user pivot;
 * `org.context` is deliberately not mounted, so the X-Organization-Id header
 * plays no role. `{organization}` and `{user}` are raw ids (no model binding).
 */
class SpendingLimitController extends Controller
{
    public const MEMBER_NOT_FOUND_MESSAGE = 'Miembro no encontrado';

    /**
     * Bare array on purpose (repo list convention, no envelope). An admin sees
     * every member; a member sees only their own row.
     */
    public function index(Request $request, SpendingLimitService $limits, string $organization): JsonResponse
    {
        $organization = $this->memberOrFail($request, $organization);

        $onlyUserId = $organization->pivot->role === OrganizationRole::ADMIN->value ? null : $request->user()->id;

        return response()->json(
            SpendingLimitResource::collection($limits->rowsFor($organization, now(), $onlyUserId))->resolve()
        );
    }

    public function update(SetSpendingLimitRequest $request, SpendingLimitService $limits, string $organization, string $user): JsonResponse
    {
        $organization = $request->organization();
        $userId = (int) $user;

        if (! $organization->users()->whereKey($userId)->exists()) {
            return response()->json(['message' => self::MEMBER_NOT_FOUND_MESSAGE], 404);
        }

        $value = $request->validated('monthly_limit');
        $limits->setLimit($organization, $userId, $value === null ? null : (string) $value);

        return response()->json(
            (new SpendingLimitResource($limits->rowsFor($organization, now(), $userId)[0]))->resolve()
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
}
