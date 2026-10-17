<?php

namespace App\Enums;

/**
 * Stored status of an organization invitation. `Expired` is persisted lazily
 * (only when an invite replaces a lapsed pending row); a pending row past its
 * `expires_at` is reported as expired through
 * OrganizationInvitation::$effective_status without being written.
 */
enum InvitationStatus: string
{
    case Pending = 'pending';
    case Accepted = 'accepted';
    case Rejected = 'rejected';
    case Cancelled = 'cancelled';
    case Expired = 'expired';
}
