<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     *
     * Append-only ledger of the organization wallet: one signed row per
     * balance change (recarga +, reserva -, reembolso +). `organization_id`
     * is restrictOnDelete, same as reservations (HUE-05 D14). `user_id` and
     * `reservation_id` are nullOnDelete so that DELETE /account (which
     * hard-deletes tenants and their reservations) never fails on ledger
     * rows; the row survives with a null reference. `type` is a string and
     * not a DB enum so a later change can add types without the enum-rewrite
     * pain of 2026_08_14_000001. `unique(reservation_id, type)` makes a
     * repeated debit or refund impossible; NULL reservation ids (recargas)
     * are distinct on both SQLite and PostgreSQL, so top-ups never collide.
     */
    public function up(): void
    {
        Schema::create('organization_wallet_movements', function (Blueprint $table) {
            $table->id();
            $table->foreignId('organization_id')->constrained()->restrictOnDelete();
            $table->foreignId('user_id')->nullable()->constrained('user')->nullOnDelete();
            $table->foreignId('reservation_id')->nullable()->constrained()->nullOnDelete();
            $table->string('type', 20);
            $table->decimal('amount', 10, 2);
            $table->decimal('balance_after', 10, 2);
            $table->timestamp('created_at')->useCurrent();

            $table->unique(['reservation_id', 'type']);
            $table->index(['organization_id', 'id']);
            $table->index(['organization_id', 'user_id']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('organization_wallet_movements');
    }
};
