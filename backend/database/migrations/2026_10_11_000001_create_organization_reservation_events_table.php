<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     *
     * Append-only audit log of what happens to organization reservations:
     * an admin cancel (`cancelled`) and a member's refused cancel or preview
     * (`denied_attempt`). `organization_id` is restrictOnDelete, same as
     * reservations. `reservation_id` and `actor_user_id` are nullOnDelete so
     * DELETE /account never fails on audit rows (wallet ledger precedent); a
     * removed pivot row never touches an event. `kind` is a string and not a
     * DB enum so a later change can add kinds cheaply.
     */
    public function up(): void
    {
        Schema::create('organization_reservation_events', function (Blueprint $table) {
            $table->id();
            $table->foreignId('organization_id')->constrained()->restrictOnDelete();
            $table->foreignId('reservation_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('actor_user_id')->nullable()->constrained('user')->nullOnDelete();
            $table->string('kind', 20);
            $table->string('attempted_action', 20)->nullable();
            $table->string('reason', 200)->nullable();
            $table->timestamp('created_at')->useCurrent();

            $table->index(['organization_id', 'id']);
            $table->index(['reservation_id', 'id']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('organization_reservation_events');
    }
};
