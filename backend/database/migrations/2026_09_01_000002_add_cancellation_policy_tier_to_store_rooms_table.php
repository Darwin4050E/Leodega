<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('storeRooms', function (Blueprint $table) {
            $table->string('cancellation_policy_tier')->nullable()->after('firefighter_permit_path');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('storeRooms', function (Blueprint $table) {
            $table->dropColumn('cancellation_policy_tier');
        });
    }
};
