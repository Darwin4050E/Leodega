<?php

namespace App\Services;

use App\Enums\WalletMovementType;
use App\Exceptions\InsufficientWalletBalanceException;
use App\Models\Organization;
use App\Models\OrganizationWalletMovement;
use App\Models\Reservations;
use App\Models\User;
use App\Support\Money;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use LogicException;

/**
 * Single writer of `organizations.wallet_balance` and of the movement ledger
 * (org-wallet OW-2). Every change runs on the organization row locked with
 * `lockForUpdate`, inside a transaction, and writes the balance and exactly
 * one signed movement together. Amounts are 2-decimal strings; the math runs
 * on integer cents (see Money).
 */
class WalletService
{
    // decimal(10,2): 99,999,999.99 in cents.
    private const MAX_CENTS = 9_999_999_999;

    public const CAPACITY_MESSAGE = 'El saldo de la organización no puede superar el máximo permitido';

    /**
     * Re-reads the organization with a row lock. Callers must use the returned
     * instance, never a stale one they loaded earlier. Lock order is
     * room -> reservation -> organization: the organization is always last.
     */
    public function lockOrganization(int $organizationId): Organization
    {
        if (DB::transactionLevel() < 1) {
            throw new LogicException('The organization wallet must be locked inside a transaction.');
        }

        return Organization::query()->lockForUpdate()->findOrFail($organizationId);
    }

    /**
     * Simulated top-up. Opens its own transaction.
     *
     * @throws \InvalidArgumentException when the amount has more than 2 decimals
     * @throws ValidationException when the balance would exceed the column capacity
     */
    public function topUp(Organization $organization, User $actor, string $amount): OrganizationWalletMovement
    {
        $cents = Money::parse($amount);

        return DB::transaction(function () use ($organization, $actor, $cents) {
            $locked = $this->lockOrganization($organization->id);

            return $this->record($locked, WalletMovementType::Recarga, $cents, $actor->id, null);
        });
    }

    /**
     * Debits the reservation total. `$locked` must come from lockOrganization()
     * in the caller's transaction.
     *
     * @throws InsufficientWalletBalanceException
     */
    public function debitForReservation(Organization $locked, Reservations $reservation, string $amount, int $creatorUserId): OrganizationWalletMovement
    {
        return $this->record($locked, WalletMovementType::Reserva, -Money::toCents($amount), $creatorUserId, $reservation->id);
    }

    /**
     * Credits a refund once per reservation. Returns null when the amount is
     * zero or the refund was already credited. The existence check runs under
     * the organization lock; the unique index is only a backstop (a unique
     * violation must never be caught inside a PostgreSQL transaction).
     */
    public function creditRefund(Organization $locked, Reservations $reservation, string $amount, int $creatorUserId): ?OrganizationWalletMovement
    {
        $cents = Money::toCents($amount);

        $alreadyCredited = OrganizationWalletMovement::query()
            ->where('reservation_id', $reservation->id)
            ->where('type', WalletMovementType::Reembolso->value)
            ->exists();

        if ($cents === 0 || $alreadyCredited) {
            return null;
        }

        return $this->record($locked, WalletMovementType::Reembolso, $cents, $creatorUserId, $reservation->id);
    }

    private function record(Organization $locked, WalletMovementType $type, int $deltaCents, ?int $userId, ?int $reservationId): OrganizationWalletMovement
    {
        $newCents = Money::toCents($locked->wallet_balance) + $deltaCents;

        if ($newCents < 0) {
            throw InsufficientWalletBalanceException::make();
        }

        if ($newCents > self::MAX_CENTS) {
            throw ValidationException::withMessages(['amount' => [self::CAPACITY_MESSAGE]]);
        }

        $balance = Money::fromCents($newCents);

        $locked->forceFill(['wallet_balance' => $balance])->save();

        return OrganizationWalletMovement::create([
            'organization_id' => $locked->id,
            'user_id' => $userId,
            'reservation_id' => $reservationId,
            'type' => $type,
            'amount' => Money::fromCents($deltaCents),
            'balance_after' => $balance,
        ]);
    }
}
