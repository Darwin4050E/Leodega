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
     * Purely additive: existing organizations start at 0.00. The column is
     * NOT NULL because a CHECK constraint passes on NULL. PostgreSQL also
     * gets a CHECK (balance >= 0) as a backstop to the WalletService guard;
     * SQLite has no ADD CONSTRAINT, so there the service guard is the only
     * protection. Only WalletService writes this column.
     */
    public function up(): void
    {
        Schema::table('organizations', function (Blueprint $table) {
            $table->decimal('wallet_balance', 10, 2)->default(0)->after('status');
        });

        if (Schema::getConnection()->getDriverName() === 'pgsql') {
            DB::statement('ALTER TABLE organizations ADD CONSTRAINT organizations_wallet_balance_nonnegative CHECK (wallet_balance >= 0)');
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        if (Schema::getConnection()->getDriverName() === 'pgsql') {
            DB::statement('ALTER TABLE organizations DROP CONSTRAINT IF EXISTS organizations_wallet_balance_nonnegative');
        }

        Schema::table('organizations', function (Blueprint $table) {
            $table->dropColumn('wallet_balance');
        });
    }
};
