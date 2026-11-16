<?php

namespace App\Http\Controllers;

use App\Enums\OrganizationRole;
use App\Enums\WalletMovementType;
use App\Http\Middleware\ResolveActiveOrganization;
use App\Http\Requests\TopUpWalletRequest;
use App\Http\Resources\WalletMovementResource;
use App\Models\Organization;
use App\Services\WalletService;
use Illuminate\Http\Exceptions\HttpResponseException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Wallet endpoints of one organization (org-wallet OW-4, OW-11, OW-12). The
 * organization comes from the URL path and membership is checked here against
 * the organization_user pivot; `org.context` is deliberately not mounted, so
 * the X-Organization-Id header plays no role. `{organization}` is read as a
 * raw id (no model binding): a non-member and a nonexistent organization must
 * get the identical 403.
 */
class OrganizationWalletController extends Controller
{
    private const MOVEMENTS_LIMIT = 50;

    public function show(Request $request, string $organization): JsonResponse
    {
        $organization = $this->memberOrFail($request, $organization);

        return response()->json([
            'organization_id' => $organization->id,
            'balance' => $organization->wallet_balance,
        ]);
    }

    /**
     * Bare array on purpose (repo list convention, no envelope). Admins see
     * every movement; a member sees their own reservations and refunds only.
     */
    public function movements(Request $request, string $organization): JsonResponse
    {
        $organization = $this->memberOrFail($request, $organization);

        $query = $organization->walletMovements()->with('user:id,name');

        if ($organization->pivot->role !== OrganizationRole::ADMIN->value) {
            $query->where('user_id', $request->user()->id)
                ->where('type', '!=', WalletMovementType::Recarga->value);
        }

        $movements = $query->orderByDesc('id')->limit(self::MOVEMENTS_LIMIT)->get();

        return response()->json(WalletMovementResource::collection($movements)->resolve());
    }

    public function topUp(TopUpWalletRequest $request, WalletService $wallet): JsonResponse
    {
        $movement = $wallet->topUp(
            $request->organization(),
            $request->user(),
            (string) $request->validated('amount'),
        );
        $movement->setRelation('user', $request->user());

        return response()->json([
            'message' => 'Recarga realizada correctamente',
            'balance' => $movement->balance_after,
            'movement' => (new WalletMovementResource($movement))->resolve(),
        ], 201);
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
