<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     *
     * Purely additive, nullable column: existing (personal) reservations
     * keep `organization_id = null`, no backfill. `restrictOnDelete()`
     * (HUE-05 D14): no endpoint deletes an organization today (only
     * `status` toggles it), so this has zero current impact, and it
     * prevents a future hard-delete from silently orphaning a paid org
     * reservation into a personal one. Indexed: both the personal
     * (`organization_id IS NULL`) and the org (`organization_id = ?`)
     * list scopes filter on this column.
     */
    public function up(): void
    {
        Schema::table('reservations', function (Blueprint $table) {
            $table->foreignId('organization_id')->nullable()->after('tenant_id')
                ->constrained()->restrictOnDelete();
            $table->index('organization_id');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('reservations', function (Blueprint $table) {
            $table->dropForeign(['organization_id']);
            $table->dropIndex(['organization_id']);
            $table->dropColumn('organization_id');
        });
    }
};
