<?php

namespace App\Services;

use App\Enums\OrganizationRole;
use App\Models\Organization;
use App\Models\Reservations;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\DB;

/**
 * Read-only aggregates behind the organization control panel (hue-03). The
 * server decides visibility: every method receives the caller's role as a
 * flag and a key a member may not see is left out, never sent as null.
 */
class OrganizationPanelService
{
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
