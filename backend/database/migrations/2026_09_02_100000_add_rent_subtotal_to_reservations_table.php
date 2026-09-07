<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Nullable, no backfill: pre-existing rows have no reliable way to
     * reconstruct the rent-only subtotal, so they stay null and are simply
     * ineligible for gestor cancellation (cancelByLandlord() rejects a null
     * rent_subtotal).
     */
    public function up(): void
    {
        Schema::table('reservations', function (Blueprint $table) {
            $table->decimal('rent_subtotal', 10, 2)->nullable()->after('total_mount');
        });
    }

    public function down(): void
    {
        Schema::table('reservations', function (Blueprint $table) {
            $table->dropColumn('rent_subtotal');
        });
    }
};
