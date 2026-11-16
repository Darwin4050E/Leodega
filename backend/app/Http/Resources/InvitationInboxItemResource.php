<?php

namespace App\Http\Resources;

use App\Enums\InvitationStatus;
use App\Models\OrganizationInvitation;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * One invitation as the invitee sees it (huc-14 INV-16). `status` is the
 * effective one (a lapsed pending reads `expired`) and `can_respond` is the
 * only permission flag, so clients never derive expiry from their own clock.
 * Expects `organization` and `inviter` to be loaded. Admin names and emails,
 * the invitee's own address, the organization's RUC, email and wallet, and the
 * inviter's id are deliberately absent. The role is display data: an accepted
 * invitation always makes a member.
 *
 * @mixin OrganizationInvitation
 */
class InvitationInboxItemResource extends JsonResource
{
    public const ROLE = 'member';

    public function toArray(Request $request): array
    {
        $status = $this->effective_status;

        return [
            'id' => $this->id,
            'organization_id' => $this->organization_id,
            'organization_name' => $this->organization->name,
            'invited_by_name' => $this->inviter?->name,
            'role' => self::ROLE,
            'status' => $status->value,
            'expires_at' => $this->expires_at->toISOString(),
            'created_at' => $this->created_at->toISOString(),
            'responded_at' => $this->responded_at?->toISOString(),
            'can_respond' => $status === InvitationStatus::Pending,
        ];
    }
}
