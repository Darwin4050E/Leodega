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
        Schema::create('store_prices', function (Blueprint $table) {
            $table->id();
            $table->foreignId('store_room_id')->constrained('storeRooms')->onDelete('cascade');
            $table->enum('mode', ['day', 'month', 'year'])->nullable(false);
            $table->decimal('price', 10, 2)->nullable(false);
            $table->boolean('disponibility')->default(true);
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('store_prices');
    }
};
