<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('reservations', function (Blueprint $table) {

            $table->text('cancelation_reason')->nullable()->change();
            $table->timestamp('creation_date')->nullable()->change();

        });
    }

    public function down(): void
    {
        Schema::table('reservations', function (Blueprint $table) {
            $table->text('cancelation_reason')->nullable(false)->change();
            $table->date('creation_date')->change();
        });
    }
};
