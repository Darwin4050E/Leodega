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
        Schema::create('organizations', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->char('ruc', 13)->unique();
            $table->string('email');
            // Disk-relative path on the `public` disk (organization_logos/...),
            // same convention as store_rooms.firefighter_permit_path.
            $table->string('logo_path')->nullable();
            $table->string('status', 20)->default('active');
            // Nullable so hard-deleting the creator's account keeps the org.
            $table->foreignId('created_by')->nullable()->constrained('user')->nullOnDelete();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('organizations');
    }
};
