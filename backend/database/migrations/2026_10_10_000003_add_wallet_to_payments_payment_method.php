<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Adds `wallet` to `payments.payment_method`, the method used by organization
 * reservations paid from the organization wallet.
 *
 * Same per-driver approach as 2026_08_14_000001_fix_reports_status_enum:
 * `$table->enum(...)->change()` is valid on SQLite but generates invalid SQL
 * on PostgreSQL, where the column's CHECK constraint is replaced by hand.
 *
 * down() fails if `wallet` rows exist (the restored CHECK rejects them).
 * That is intentional at this stage: rolling back must not silently rewrite
 * payments.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (Schema::getConnection()->getDriverName() === 'sqlite') {
            Schema::table('payments', function (Blueprint $table) {
                $table->enum('payment_method', ['credit card', 'debit card', 'wallet'])
                    ->nullable(false)
                    ->change();
            });

            return;
        }

        DB::statement('ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_payment_method_check');
        DB::statement("ALTER TABLE payments ADD CONSTRAINT payments_payment_method_check CHECK (payment_method IN ('credit card','debit card','wallet'))");
    }

    public function down(): void
    {
        if (Schema::getConnection()->getDriverName() === 'sqlite') {
            Schema::table('payments', function (Blueprint $table) {
                $table->enum('payment_method', ['credit card', 'debit card'])
                    ->nullable(false)
                    ->change();
            });

            return;
        }

        DB::statement('ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_payment_method_check');
        DB::statement("ALTER TABLE payments ADD CONSTRAINT payments_payment_method_check CHECK (payment_method IN ('credit card','debit card'))");
    }
};
