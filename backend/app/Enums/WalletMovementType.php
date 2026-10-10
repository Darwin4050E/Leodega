<?php

namespace App\Enums;

/**
 * Kind of a signed ledger row in the organization wallet. The column is a
 * plain string in the database; this enum is the application-side whitelist.
 */
enum WalletMovementType: string
{
    case Recarga = 'recarga';
    case Reserva = 'reserva';
    case Reembolso = 'reembolso';
}
