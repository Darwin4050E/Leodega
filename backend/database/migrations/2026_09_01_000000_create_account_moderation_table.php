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
        Schema::create('account_moderation', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained('user')->cascadeOnDelete();
            $table->foreignId('admin_id')->nullable()->constrained('user')->nullOnDelete();
            $table->enum('action', ['block', 'reactivate']);
            $table->text('reason')->nullable();
            $table->timestamp('moderation_date')->useCurrent();
            $table->timestamps();
            $table->index(['user_id', 'moderation_date']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('account_moderation');
    }
};
