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
     * One row is the invitation, the audit record and the invitee inbox
     * source. There is no token: the invitee is identified by id. The partial
     * unique index caps pending rows per (organization, invitee) while letting
     * rejected / cancelled / expired rows repeat; the same raw SQL is valid on
     * SQLite and PostgreSQL (Blueprint has no partial-index API). The status
     * CHECK exists only on PostgreSQL, SQLite has no ADD CONSTRAINT.
     */
    public function up(): void
    {
        Schema::create('organization_invitations', function (Blueprint $table) {
            $table->id();
            $table->foreignId('organization_id')->constrained()->cascadeOnDelete();
            $table->foreignId('invited_user_id')->constrained('user')->cascadeOnDelete();
            $table->foreignId('invited_by_user_id')->nullable()->constrained('user')->nullOnDelete();
            $table->string('email', 255);
            $table->string('status', 20)->default('pending');
            $table->timestamp('expires_at');
            $table->timestamp('responded_at')->nullable();
            $table->timestamps();

            $table->index(['invited_user_id', 'status']);
            $table->index(['organization_id', 'status']);
        });

        DB::statement("CREATE UNIQUE INDEX organization_invitations_pending_unique ON organization_invitations (organization_id, invited_user_id) WHERE status = 'pending'");

        if (DB::getDriverName() === 'pgsql') {
            DB::statement("ALTER TABLE organization_invitations ADD CONSTRAINT organization_invitations_status_check CHECK (status IN ('pending', 'accepted', 'rejected', 'expired', 'cancelled'))");
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('organization_invitations');
    }
};
