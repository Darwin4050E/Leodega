<?php

namespace App\Models;

use App\Enums\WalletMovementType;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use LogicException;

/**
 * One signed row of the organization wallet ledger. Append-only: rows are
 * inserted by WalletService and never modified or removed, so the ledger
 * always explains the cached `organizations.wallet_balance`.
 */
class OrganizationWalletMovement extends Model
{
    use HasFactory;

    public const UPDATED_AT = null;

    // Written only by WalletService, never from request data.
    protected $fillable = [
        'organization_id',
        'user_id',
        'reservation_id',
        'type',
        'amount',
        'balance_after',
    ];

    protected function casts(): array
    {
        return [
            'type' => WalletMovementType::class,
            'amount' => 'decimal:2',
            'balance_after' => 'decimal:2',
        ];
    }

    protected static function booted(): void
    {
        static::updating(function () {
            throw new LogicException('Wallet movements are append-only and cannot be updated.');
        });

        static::deleting(function () {
            throw new LogicException('Wallet movements are append-only and cannot be deleted.');
        });
    }

    public function organization()
    {
        return $this->belongsTo(Organization::class);
    }

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function reservation()
    {
        return $this->belongsTo(Reservations::class, 'reservation_id');
    }
}
