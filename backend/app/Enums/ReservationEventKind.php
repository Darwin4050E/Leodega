<?php

namespace App\Enums;

/**
 * Kind of a row in the organization reservation event log. The column is a
 * plain string in the database; this enum is the application-side whitelist.
 */
enum ReservationEventKind: string
{
    case Cancelled = 'cancelled';
    case DeniedAttempt = 'denied_attempt';
}
