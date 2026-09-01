<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('reservations', function (Blueprint $table) {
            $table->id();
            $table->foreignId('store_room_id')->constrained('storeRooms')->onDelete('cascade');
            $table->foreignId('tenant_id')->constrained('tenants')->onDelete('cascade');
            $table->date('start_date')->default(DB::raw('CURRENT_DATE'));
            $table->date('end_date');
            $table->enum('status', ['pending', 'confirmed', 'canceled'])->default('pending');
            $table->decimal('total_mount', 10, 2);
            $table->text('cancelation_reason');
            $table->date(('creation_date'))->default(DB::raw('CURRENT_TIMESTAMP'));

            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('reservations');
    }
};
