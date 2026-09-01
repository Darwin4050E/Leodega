<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Mismo bug que en `favorites`: la FK apuntaba a `users` (tabla muerta),
     * no a `user` (tabla real), por lo que crear un registro de Admin con un
     * user_id real fallaba siempre por violación de integridad referencial.
     */
    public function up(): void
    {
        Schema::table('admin', function (Blueprint $table) {
            $table->dropForeign(['user_id']);
        });

        Schema::table('admin', function (Blueprint $table) {
            $table->foreign('user_id')->references('id')->on('user')->onDelete('cascade');
        });
    }

    public function down(): void
    {
        Schema::table('admin', function (Blueprint $table) {
            $table->dropForeign(['user_id']);
        });

        Schema::table('admin', function (Blueprint $table) {
            $table->foreign('user_id')->references('id')->on('users')->onDelete('cascade');
        });
    }
};
