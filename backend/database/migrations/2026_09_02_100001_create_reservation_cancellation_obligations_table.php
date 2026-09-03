<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Flat fact table recording a HUG-06 gestor cancellation: what the
     * client is owed, what the gestor owes as a penalty, and the rate that
     * produced it, all snapshotted at write time so a later rate change or
     * storeroom deletion never rewrites history.
     *
     * landlord_id is snapshotted (not resolved live through
     * reservation.storeRooms.landlord_id) because StoreRooms uses
     * SoftDeletes and a canceled reservation no longer blocks storeroom
     * deletion: without this column the debtor becomes unreachable the
     * moment the gestor soft-deletes the storeroom after cancelling.
     */
    public function up(): void
    {
        Schema::create('reservation_cancellation_obligations', function (Blueprint $table) {
            $table->id();
            $table->foreignId('reservation_id')->constrained('reservations')->onDelete('cascade');
            $table->foreignId('landlord_id')->constrained('landlords')->onDelete('cascade');
            $table->decimal('refund_amount', 10, 2);
            $table->decimal('penalty_amount', 10, 2);
            $table->decimal('penalty_rate', 5, 4);
            $table->text('reason');
            $table->enum('settlement_status', ['pending_settlement', 'settled'])->default('pending_settlement');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('reservation_cancellation_obligations');
    }
};
