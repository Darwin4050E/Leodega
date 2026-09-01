<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * `users` es el remanente muerto del scaffold por defecto de Laravel
     * (creada en 2025_10_15_160620_create_users_table.php). Los usuarios reales
     * viven en `user` (singular, ver App\Models\User::$table). Nada la usaba
     * legítimamente: solo estaba referenciada por FKs y reglas de validación
     * mal apuntadas, ya corregidas en las migraciones/controladores previos a
     * esta. Se elimina aquí, en una migración nueva, en vez de borrar la
     * migración original — así el historial de migraciones se mantiene íntegro
     * en entornos donde ya se haya aplicado.
     */
    public function up(): void
    {
        Schema::dropIfExists('users');
    }

    public function down(): void
    {
        Schema::create('users', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('email')->unique();
            $table->string('password');
            $table->enum('role', ['admin', 'landlord', 'tenant'])->default('landlord');
            $table->date('start_date')->nullable();
            $table->enum('state', ['active', 'blocked', 'pending'])->default('active');
            $table->boolean('enable_messages')->default(true);
            $table->timestamps();
        });
    }
};
