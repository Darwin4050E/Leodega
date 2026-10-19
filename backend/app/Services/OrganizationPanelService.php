<?php

namespace App\Services;

use App\Enums\OrganizationRole;
use App\Enums\WalletMovementType;
use App\Models\Organization;
use App\Models\OrganizationWalletMovement;
use App\Models\Reservations;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Pagination\LengthAwarePaginator;
use Illuminate\Support\Facades\DB;

/**
 * Read-only aggregates behind the organization control panel (hue-03). The
 * server decides visibility: every method receives the caller's role as a
 * flag and a key a member may not see is left out, never sent as null.
 */
class OrganizationPanelService
{
    private const RESERVATIONS_PER_PAGE = 20;

    public function __construct(private readonly SpendingLimitService $spendLedger) {}

    public function summary(Organization $organization, User $caller, bool $isAdmin): array
    {
        $summary = [
            'organization_id' => $organization->id,
            'role' => ($isAdmin ? OrganizationRole::ADMIN : OrganizationRole::MEMBER)->value,
            'members_count' => $organization->users()->count(),
            'active_reservations_count' => $this->activeReservations($organization, $caller, $isAdmin)->count(),
        ];

        if ($isAdmin) {
            $summary['pending_invitations_count'] = $organization->invitations()->pending()->count();
        }

        return $summary;
    }

    /**
     * One row per member in membership order. Visibility is decided here: an
     * admin gets email, limit and spend for every row; a member gets no email
     * and limit and spend on their own row only. A key the caller may not see
     * is not in the row at all.
     *
     * @return list<array<string, mixed>>
     */
    public function members(Organization $organization, User $caller, bool $isAdmin): array
    {
        $spent = $this->spendLedger->spentCentsByUser($organization->id, now(), $isAdmin ? null : $caller->id);
        $columns = ['ou.user_id', 'u.name', 'ou.role', 'ou.monthly_limit', 'ou.joined_at'];

        return DB::table('organization_user as ou')
            ->join('user as u', 'u.id', '=', 'ou.user_id')
            ->where('ou.organization_id', $organization->id)
            ->orderBy('ou.id')
            ->get($isAdmin ? [...$columns, 'u.email'] : $columns)
            ->map(function ($row) use ($caller, $isAdmin, $spent) {
                $isSelf = (int) $row->user_id === $caller->id;
                $member = [
                    'user_id' => (int) $row->user_id,
                    'name' => $row->name,
                    'role' => $row->role,
                    'joined_at' => $row->joined_at,
                    'is_self' => $isSelf,
                ];

                if ($isAdmin) {
                    $member['email'] = $row->email;
                }

                if ($isAdmin || $isSelf) {
                    $member['monthly_limit'] = $row->monthly_limit;
                    $member['spent_cents'] = $spent[$row->user_id] ?? 0;
                }

                return $member;
            })
            ->all();
    }

    /**
     * One page of the active reservations, oldest start first, ties by id so
     * pages never repeat or skip a row. Names are null when the warehouse or
     * the creator is gone. Whether a row was paid from the wallet costs one
     * extra query for the whole page, not one per row.
     */
    public function reservations(Organization $organization, User $caller, bool $isAdmin): LengthAwarePaginator
    {
        $page = $this->activeReservations($organization, $caller, $isAdmin)
            ->with(['tenants.user:id,name', 'storeRooms:id,title'])
            ->orderBy('start_date')
            ->orderBy('id')
            ->paginate(self::RESERVATIONS_PER_PAGE);

        $paidWithWallet = OrganizationWalletMovement::query()
            ->whereIn('reservation_id', $page->getCollection()->modelKeys())
            ->where('type', WalletMovementType::Reserva)
            ->pluck('reservation_id')
            ->flip();

        return $page->through(fn (Reservations $reservation) => [
            'id' => $reservation->id,
            'warehouse_name' => $reservation->storeRooms?->title,
            'member_name' => $reservation->tenants?->user?->name,
            'start_date' => $reservation->start_date,
            'end_date' => $reservation->end_date,
            'status' => $reservation->status,
            'total_mount' => $reservation->total_mount,
            'paid_with_wallet' => $paidWithWallet->has($reservation->id),
        ]);
    }

    /**
     * The single definition of "active reservation" for the panel: the summary
     * counts it and the reservations table pages it, so card and table cannot
     * drift. It ends today or later and is confirmed or holds an unexpired
     * payment. Read-only: the lazy hold-expiry sweep is deliberately not run,
     * an expired hold is just filtered out. A member sees only their own.
     */
    public function activeReservations(Organization $organization, User $caller, bool $isAdmin): Builder
    {
        return Reservations::query()
            ->where('organization_id', $organization->id)
            ->whereDate('end_date', '>=', today())
            ->where(fn (Builder $query) => $query
                ->where('status', 'confirmed')
                ->orWhere(fn (Builder $query) => $query->activeHold()))
            ->when(! $isAdmin, fn (Builder $query) => $query->where('tenant_id', $caller->tenant?->id ?? 0));
    }
}
