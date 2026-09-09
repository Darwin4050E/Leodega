<?php

namespace App\Services;

use App\Models\AccountModeration;
use App\Models\Reports;
use App\Models\Reservations;
use App\Models\StoreModeration;
use App\Models\StoreRooms;
use App\Models\User;

/**
 * Computes the admin dashboard's five summary metrics and the merged
 * moderation activity feed. First aggregate-endpoint service in the
 * codebase — see design #197's "Service-layer placement and query shape"
 * decision: one small named query per metric, mirroring the existing
 * `->count()`/relation precedent (`NotificationsController::index`,
 * `StoreRooms::activeReservations()`), never a hand-rolled raw aggregate.
 */
class DashboardService
{
    /**
     * `reservations_this_month` and `open_reports` intentionally read
     * `created_at`/`status = 'pending'` — never the legacy nullable
     * `creation_date` column, and never the removed `in_review` report
     * status (migration `2026_08_14_000001`).
     */
    public function summary(): array
    {
        return [
            'active_store_rooms' => StoreRooms::where('publication_status', 'approved')->count(),
            'pending_moderation' => StoreRooms::where('publication_status', 'pending')->count(),
            'reservations_this_month' => Reservations::whereBetween('created_at', [
                now()->startOfMonth(),
                now()->endOfMonth(),
            ])->where('status', 'confirmed')->count(),
            'open_reports' => Reports::where('status', 'pending')->count(),
            'accounts' => [
                'total' => User::where('role', '!=', 'admin')->count(),
                'blocked' => User::where('role', '!=', 'admin')->where('state', 'blocked')->count(),
            ],
        ];
    }

    /**
     * Merges `store_moderation` and `account_moderation` into one list,
     * newest first by `created_at` — never `moderation_date`, per design
     * #197's ordering decision (`store_moderation.moderation_date` is
     * date-precision, `account_moderation.moderation_date` is
     * timestamp-precision; comparing them directly misorders same-day
     * entries). Top-`$limit` rows are pulled from each table before the
     * merge, which is provably sufficient: the true top-`$limit` of the
     * union can never draw more than `$limit` items from a single source.
     */
    public function activity(int $limit = 10): array
    {
        $store = StoreModeration::with(['admin', 'storeRoom'])
            ->orderByDesc('created_at')
            ->orderByDesc('id')
            ->limit($limit)
            ->get()
            ->map(fn ($moderation) => $this->normalizeStoreModeration($moderation));

        $account = AccountModeration::with(['admin', 'user'])
            ->orderByDesc('created_at')
            ->orderByDesc('id')
            ->limit($limit)
            ->get()
            ->map(fn ($moderation) => $this->normalizeAccountModeration($moderation));

        return $store->concat($account)
            ->sortByDesc(fn ($entry) => $entry['occurred_at'])
            ->values()
            ->take($limit)
            ->all();
    }

    private function normalizeStoreModeration(StoreModeration $moderation): array
    {
        return [
            'id' => "store:{$moderation->id}",
            'actor' => $moderation->admin?->name,
            'action' => $moderation->status,
            'target' => $moderation->storeRoom?->title ?? '—',
            'occurred_at' => $moderation->created_at,
            'tone' => $moderation->status === 'rejected' ? 'err' : 'ok',
            'note' => $moderation->status === 'rejected' && $moderation->reason_rejected !== ''
                ? $moderation->reason_rejected
                : null,
        ];
    }

    private function normalizeAccountModeration(AccountModeration $moderation): array
    {
        $action = $moderation->action === 'block' ? 'blocked' : 'reactivated';

        return [
            'id' => "account:{$moderation->id}",
            'actor' => $moderation->admin?->name,
            'action' => $action,
            'target' => $moderation->user?->name ?? '—',
            'occurred_at' => $moderation->created_at,
            'tone' => $action === 'blocked' ? 'err' : 'ok',
            'note' => $moderation->reason,
        ];
    }
}
