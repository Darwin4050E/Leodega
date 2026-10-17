<?php

namespace App\Http\Resources;

use App\Enums\InvitationStatus;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * One invitation as the organization admins see it (hue-01 INV-6, INV-9).
 * `status` is the effective one (a lapsed pending reads `expired`) and
 * `can_be_revoked` is the only permission flag, so clients never derive expiry
 * from their own clock. The invitee's id and name are deliberately absent.
 *
 * @mixin \App\Models\OrganizationInvitation
 */
class InvitationResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $status = $this->effective_status;

        return [
            'id' => $this->id,
            'email' => $this->email,
            'status' => $status->value,
            'expires_at' => $this->expires_at->toISOString(),
            'created_at' => $this->created_at->toISOString(),
            'responded_at' => $this->responded_at?->toISOString(),
            'invited_by_name' => $this->inviter?->name,
            'can_be_revoked' => $status === InvitationStatus::Pending,
        ];
    }
}
