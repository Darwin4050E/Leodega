<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * `cancellation_policy_tier` (sdd/tenant-self-cancel decision #339):
     * snapshots the storeroom's tier onto the reservation at booking time
     * (populated going forward by ReservationService::create()), so a
     * landlord changing their storeroom's tier later never changes what an
     * already-paying tenant gets back.
     *
     * `refund_amount`: recorded by ReservationService::cancelByTenant() when
     * a tenant self-cancels. Lives on `reservations`, not `payments`,
     * because `Reservations::payments()` is a `hasMany` with no unique
     * constraint on `reservation_id` -- "which payment row" would be
     * undefined. Same relationship `cancelation_reason` already has to the
     * reservation's cancellation event.
     *
     * Reconciliation #1 (overrides this change's design, which proposed
     * leaving the snapshot NULL for legacy rows and refusing to cancel
     * them): `cancellation_policy_tier` was dead data on `storeRooms`,
     * collected at publish time but never read by any refund/pricing logic
     * and never shown to a customer, until this change gave it a consumer.
     * No pre-existing reservation was ever booked under a real policy, so
     * assigning one retroactively based on the storeroom's current tier
     * would be arbitrary and reversible by a landlord's post-hoc edit. The
     * explicit UPDATE below backfills every existing reservation to
     * `flexible` -- the most tenant-favorable tier (100% refund until one
     * day before start) -- as a deliberate decision, not a nullable-with-
     * default shortcut.
     */
    public function up(): void
    {
        Schema::table('reservations', function (Blueprint $table) {
            $table->string('cancellation_policy_tier')->nullable()->after('cancelation_reason');
            $table->decimal('refund_amount', 10, 2)->nullable()->after('cancellation_policy_tier');
        });

        DB::table('reservations')->update(['cancellation_policy_tier' => 'flexible']);
    }

    public function down(): void
    {
        Schema::table('reservations', function (Blueprint $table) {
            $table->dropColumn(['cancellation_policy_tier', 'refund_amount']);
        });
    }
};
