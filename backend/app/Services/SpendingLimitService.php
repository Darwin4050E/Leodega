<?php

namespace App\Services;

use App\Enums\WalletMovementType;
use App\Exceptions\MonthlyLimitExceededException;
use App\Models\Organization;
use App\Models\OrganizationWalletMovement;
use App\Models\Reservations;
use App\Support\Money;
use Carbon\Carbon;
use Carbon\CarbonInterface;
use Illuminate\Support\Facades\DB;
use LogicException;

/**
 * Per-member monthly spending limit (member-spending-limit ML-3..ML-6).
 *
 * "Spent" is read from the wallet ledger, never from a counter: the negated
 * sum of the member's `reserva` and `reembolso` movements whose reservation
 * STARTS in the month. A refund therefore frees exactly the refunded amount
 * and a cancellation penalty stays counted. All math runs on integer cents.
 */
class SpendingLimitService
{
    /**
     * Rejects the booking when `spent + total` would exceed the member's limit
     * for the reservation's start month; equality is allowed. Must run on the
     * organization row locked by WalletService::lockOrganization(), before the
     * debit, so the spend it reads cannot change under it. The new reservation
     * has no ledger row yet, so it is not counted twice.
     *
     * @throws MonthlyLimitExceededException
     */
    public function assertMaySpend(Organization $locked, int $userId, Reservations $reservation, string $total): void
    {
        if (DB::transactionLevel() < 1) {
            throw new LogicException('The monthly limit must be checked inside the transaction that holds the organization lock.');
        }

        $limit = $this->limitCents($locked->id, $userId);

        if ($limit === null) {
            return;
        }

        $spent = $this->spentCentsByUser($locked->id, Carbon::parse($reservation->start_date), $userId)[$userId] ?? 0;

        if ($spent + Money::toCents($total) > $limit) {
            throw MonthlyLimitExceededException::make();
        }
    }

    /**
     * The member's limit in cents, or null for "no limit". Read straight from
     * the table, not through a hydrated pivot, so a stale model can never
     * decide. A missing membership row reads as no limit.
     */
    public function limitCents(int $organizationId, int $userId): ?int
    {
        $limit = DB::table('organization_user')
            ->where('organization_id', $organizationId)
            ->where('user_id', $userId)
            ->value('monthly_limit');

        return $limit === null ? null : Money::toCents($limit);
    }

    /**
     * Net spend per user, in cents, for the calendar month of `$month`.
     *
     * @return array<int, int> user id => spent cents
     */
    public function spentCentsByUser(int $organizationId, CarbonInterface $month, ?int $userId = null): array
    {
        $first = $month->copy()->startOfMonth()->toDateString();
        $last = $month->copy()->endOfMonth()->toDateString();

        // Inner join: a movement whose reservation was hard-deleted has a NULL
        // reservation_id and drops out. Summed in PHP as cents; SQL SUM
        // returns a different type per driver.
        $rows = OrganizationWalletMovement::query()
            ->join('reservations as r', 'r.id', '=', 'organization_wallet_movements.reservation_id')
            ->where('organization_wallet_movements.organization_id', $organizationId)
            ->when($userId !== null, fn ($query) => $query->where('organization_wallet_movements.user_id', $userId))
            ->whereIn('organization_wallet_movements.type', [WalletMovementType::Reserva->value, WalletMovementType::Reembolso->value])
            ->whereDate('r.start_date', '>=', $first)
            ->whereDate('r.start_date', '<=', $last)
            ->get(['organization_wallet_movements.user_id', 'organization_wallet_movements.amount']);

        $spent = [];
        foreach ($rows as $row) {
            $spent[$row->user_id] = ($spent[$row->user_id] ?? 0) - Money::toCents($row->amount);
        }

        return $spent;
    }

    /**
     * One row per member, in membership order, with the stored limit and the
     * cents spent in the month of `$month`. `$onlyUserId` narrows it to one
     * member. The spend comes from spentCentsByUser(), the figure the guard
     * uses.
     *
     * @return list<array{user_id: int, name: string, role: string, monthly_limit: string|int|float|null, spent_cents: int}>
     */
    public function rowsFor(Organization $organization, CarbonInterface $month, ?int $onlyUserId = null): array
    {
        $spent = $this->spentCentsByUser($organization->id, $month, $onlyUserId);

        return DB::table('organization_user as ou')
            ->join('user as u', 'u.id', '=', 'ou.user_id')
            ->where('ou.organization_id', $organization->id)
            ->when($onlyUserId !== null, fn ($query) => $query->where('ou.user_id', $onlyUserId))
            ->orderBy('ou.id')
            ->get(['ou.user_id', 'u.name', 'ou.role', 'ou.monthly_limit'])
            ->map(fn ($row) => [
                'user_id' => (int) $row->user_id,
                'name' => $row->name,
                'role' => $row->role,
                'monthly_limit' => $row->monthly_limit,
                'spent_cents' => $spent[$row->user_id] ?? 0,
            ])
            ->all();
    }

    /**
     * Sets or clears (null) an existing member's limit. A single-row UPDATE,
     * so it takes no organization lock: a booking either sees the old or the
     * new value, both valid. The caller has already validated `$limit`.
     */
    public function setLimit(Organization $organization, int $userId, ?string $limit): void
    {
        $organization->users()->updateExistingPivot($userId, [
            'monthly_limit' => $limit === null ? null : Money::fromCents(Money::parse($limit)),
        ]);
    }

    /**
     * A stored limit as a scale-2 string. SQLite hands DECIMAL columns back as
     * int or float, PostgreSQL as a string.
     */
    public static function formatLimit(string|int|float|null $limit): ?string
    {
        return $limit === null ? null : Money::fromCents(Money::toCents($limit));
    }
}
