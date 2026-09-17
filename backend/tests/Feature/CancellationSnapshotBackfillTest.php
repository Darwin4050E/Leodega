<?php

namespace Tests\Feature;

use App\Models\StoreRooms;
use App\Models\Tenants;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

/**
 * Reconciliation #1 (sdd/tenant-self-cancel): the migration backfills EVERY
 * pre-existing reservation to `flexible`, overriding the design's original
 * "leave NULL and refuse to cancel legacy rows" — the tier was dead data
 * never shown to any customer, so no stricter tier is fair retroactively.
 *
 * This test simulates a "pre-existing" row by rolling the migration back,
 * inserting a raw row (bypassing the model, exactly like data that existed
 * before this migration ever ran), then re-applying the migration and
 * asserting the backfill.
 */
class CancellationSnapshotBackfillTest extends TestCase
{
    use RefreshDatabase;

    public function test_backfill_sets_flexible_tier_on_pre_existing_reservation()
    {
        $migration = require database_path(
            'migrations/2026_09_17_000000_add_cancellation_snapshot_and_refund_to_reservations_table.php'
        );

        $migration->down();

        $room = StoreRooms::factory()->create();
        $tenant = Tenants::factory()->create();

        $reservationId = DB::table('reservations')->insertGetId([
            'store_room_id' => $room->id,
            'tenant_id' => $tenant->id,
            'start_date' => now()->addDays(10)->toDateString(),
            'end_date' => now()->addDays(15)->toDateString(),
            'status' => 'confirmed',
            'total_mount' => 100,
            'rent_subtotal' => 80,
            'cancelation_reason' => null,
            'creation_date' => now(),
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $migration->up();

        $tier = DB::table('reservations')->where('id', $reservationId)->value('cancellation_policy_tier');

        $this->assertSame('flexible', $tier);
    }
}
