<?php

namespace App\Http\Controllers;

use App\Http\Resources\InvitationInboxItemResource;
use App\Services\OrganizationInvitationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * The invitations addressed to the authenticated tenant (huc-14 INV-15). The
 * routes are personal: the invitation is looked up by `invited_user_id` = the
 * caller, never through an organization, and `{invitation}` is a raw id (no
 * model binding).
 */
class InvitationInboxController extends Controller
{
    public function index(Request $request, OrganizationInvitationService $invitations): JsonResponse
    {
        $inbox = $invitations->listForInvitee($request->user());

        return response()->json([
            'data' => InvitationInboxItemResource::collection($inbox['invitations'])->resolve($request),
            'pending_count' => $inbox['pending_count'],
        ]);
    }

    public function reject(Request $request, OrganizationInvitationService $invitations, string $invitation): JsonResponse
    {
        $rejected = $invitations->reject($request->user(), (int) $invitation);

        return response()->json((new InvitationInboxItemResource($rejected))->resolve($request));
    }
}
