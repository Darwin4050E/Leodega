<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     *
     * Purely additive, nullable columns: no backfill of `reason_code`/`admin_id`
     * on historical `store_moderation` rows (SDD 2 decision #172.2/#172.9).
     * `admin_id` mirrors `account_moderation.admin_id` exactly, including
     * `constrained('user')` — the real users table is SINGULAR `user`
     * (`users` was created and dropped, see 2026_07_31_100002_drop_users_table.php) —
     * and `nullOnDelete()`.
     */
    public function up(): void
    {
        Schema::table('store_moderation', function (Blueprint $table) {
            $table->enum('reason_code', ['fotos', 'info', 'permiso', 'otro'])->nullable()->after('reason_rejected');
            $table->foreignId('admin_id')->nullable()->constrained('user')->nullOnDelete()->after('reason_code');
            $table->timestamp('permit_waived_at')->nullable()->after('admin_id');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('store_moderation', function (Blueprint $table) {
            $table->dropForeign(['admin_id']);
            $table->dropColumn(['reason_code', 'admin_id', 'permit_waived_at']);
        });
    }
};
