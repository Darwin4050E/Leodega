<?php

namespace App\Services;

use App\Enums\ReservationEventKind;
use App\Enums\WalletMovementType;
use App\Models\Organization;
use App\Models\OrganizationReservationEvent;
use App\Models\OrganizationWalletMovement;
use App\Models\Reservations;
use Illuminate\Database\Query\Builder;
use Illuminate\Pagination\LengthAwarePaginator;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

/**
 * Activity feed of the organization control panel (hue-03 PAN-8..PAN-10),
 * derived at read time from existing data; nothing is stored for it.
 *
 * Two steps: a UNION ALL of narrow selects (kind, source id, instant, rank)
 * is ordered and paged in SQL, then only the rows of the page are hydrated
 * with one query per source. Landlord cancels and hold expiries write no
 * event, so they have no cancelled row; the refund row is their trace.
 */
class OrganizationHistoryService
{
    /**
     * Kind => tiebreak rank for rows sharing an instant (higher is newer).
     * Also the source of the SQL literals, so tests and query cannot drift.
     */
    public const RANK = [
        'wallet_refund' => 5,
        'reservation_cancelled' => 4,
        'wallet_topup' => 3,
        'reservation_created' => 2,
        'member_joined' => 1,
    ];

    private const PER_PAGE = 20;

    /**
     * @return LengthAwarePaginator<int, array{id: string, kind: string, occurred_at: string, actor_name: ?string, target_label: ?string, amount: string|int|float|null}>
     */
    public function page(Organization $organization): LengthAwarePaginator
    {
        $page = DB::query()
            ->fromSub($this->union($organization->id), 'history')
            ->orderByDesc('occurred_at')
            ->orderByDesc('kind_rank')
            ->orderByDesc('source_id')
            ->paginate(self::PER_PAGE);

        $details = $this->details($page->getCollection());

        return $page->through(fn (object $row) => ['id' => "{$row->kind}:{$row->source_id}", 'kind' => $row->kind, 'occurred_at' => $row->occurred_at] + $details["{$row->kind}:{$row->source_id}"]);
    }

    private function union(int $organizationId): Builder
    {
        $branches = [
            $this->branch('reservation_created', DB::table('reservations'), 'id', 'created_at')
                ->where('organization_id', $organizationId),
            $this->branch('reservation_cancelled', DB::table('organization_reservation_events'), 'id', 'created_at')
                ->where('organization_id', $organizationId)
                ->where('kind', ReservationEventKind::Cancelled->value),
            $this->branch('wallet_topup', DB::table('organization_wallet_movements'), 'id', 'created_at')
                ->where('organization_id', $organizationId)
                ->where('type', WalletMovementType::Recarga->value),
            $this->branch('wallet_refund', DB::table('organization_wallet_movements'), 'id', 'created_at')
                ->where('organization_id', $organizationId)
                ->where('type', WalletMovementType::Reembolso->value),
            $this->branch('member_joined', DB::table('organization_user'), 'id', 'joined_at')
                ->where('organization_id', $organizationId)
                ->whereNotNull('joined_at'),
        ];

        $union = array_shift($branches);
        foreach ($branches as $branch) {
            $union->unionAll($branch);
        }

        return $union;
    }

    /**
     * Kind and rank go in as raw literals taken from RANK, never from input:
     * PostgreSQL cannot infer the type of a bound parameter in a UNION select
     * list. Bindings stay in the WHERE clauses.
     */
    private function branch(string $kind, Builder $query, string $idColumn, string $timeColumn): Builder
    {
        return $query->selectRaw("'{$kind}' as kind, {$idColumn} as source_id, {$timeColumn} as occurred_at, ".self::RANK[$kind].' as kind_rank');
    }

    /**
     * Actor, target and amount of the page rows, keyed "kind:source_id".
     * A missing user, reservation or warehouse leaves the field null.
     *
     * @param  Collection<int, object>  $rows
     * @return array<string, array{actor_name: ?string, target_label: ?string, amount: string|int|float|null}>
     */
    private function details(Collection $rows): array
    {
        $ids = fn (string ...$kinds) => $rows->whereIn('kind', $kinds)->pluck('source_id')->all();
        $details = [];

        Reservations::with(['tenants.user:id,name', 'storeRooms:id,title'])
            ->whereKey($ids('reservation_created'))->get()
            ->each(function (Reservations $reservation) use (&$details) {
                $details["reservation_created:{$reservation->id}"] = $this->detail($reservation->tenants?->user?->name, $reservation->storeRooms?->title, $reservation->total_mount);
            });

        OrganizationReservationEvent::with(['actor:id,name', 'reservation.storeRooms:id,title'])
            ->whereKey($ids('reservation_cancelled'))->get()
            ->each(function (OrganizationReservationEvent $event) use (&$details) {
                $details["reservation_cancelled:{$event->id}"] = $this->detail($event->actor?->name, $event->reservation?->storeRooms?->title);
            });

        OrganizationWalletMovement::with(['user:id,name', 'reservation.storeRooms:id,title'])
            ->whereKey($ids('wallet_topup', 'wallet_refund'))->get()
            ->each(function (OrganizationWalletMovement $movement) use (&$details) {
                $kind = $movement->type === WalletMovementType::Recarga ? 'wallet_topup' : 'wallet_refund';
                $details["{$kind}:{$movement->id}"] = $this->detail($movement->user?->name, $movement->reservation?->storeRooms?->title, $movement->amount);
            });

        DB::table('organization_user as ou')
            ->join('user as u', 'u.id', '=', 'ou.user_id')
            ->whereIn('ou.id', $ids('member_joined'))
            ->get(['ou.id', 'u.name'])
            ->each(function (object $row) use (&$details) {
                $details["member_joined:{$row->id}"] = $this->detail($row->name);
            });

        return $details;
    }

    private function detail(?string $actor, ?string $target = null, string|int|float|null $amount = null): array
    {
        return ['actor_name' => $actor, 'target_label' => $target, 'amount' => $amount];
    }
}
