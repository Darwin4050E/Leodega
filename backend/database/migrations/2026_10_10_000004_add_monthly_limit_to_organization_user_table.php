<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     *
     * Purely additive: NULL means "no limit", so every existing membership
     * keeps behaving exactly as before. PostgreSQL also gets a CHECK as a
     * backstop to the request and service validation; SQLite has no ADD
     * CONSTRAINT, so there those two layers are the only protection.
     */
    public function up(): void
    {
        Schema::table('organization_user', function (Blueprint $table) {
            $table->decimal('monthly_limit', 10, 2)->nullable()->after('role');
        });

        if (Schema::getConnection()->getDriverName() === 'pgsql') {
            DB::statement('ALTER TABLE organization_user ADD CONSTRAINT organization_user_monthly_limit_valid CHECK (monthly_limit IS NULL OR (monthly_limit > 0 AND monthly_limit <= 999999.99))');
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        if (Schema::getConnection()->getDriverName() === 'pgsql') {
            DB::statement('ALTER TABLE organization_user DROP CONSTRAINT IF EXISTS organization_user_monthly_limit_valid');
        }

        Schema::table('organization_user', function (Blueprint $table) {
            $table->dropColumn('monthly_limit');
        });
    }
};
