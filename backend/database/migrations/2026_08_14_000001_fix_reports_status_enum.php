<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Corrige la inconsistencia entre el enum de `reports.status`
 * (['pending','in_review','resolved']) y el valor real que
 * ReportsController::updateStatus() persiste ('canceled'), que no
 * pertenecía al enum. Se elimina 'in_review' (nunca asignado por
 * ningún endpoint) y se agrega 'canceled'.
 *
 * $table->enum(...)->change() no es portable aquí: en PostgreSQL,
 * Laravel 12 genera `ALTER COLUMN ... TYPE ... check (...)` en una
 * sola cláusula, que es sintaxis inválida en PostgreSQL (verificado
 * contra postgres:16 real). SQLite sí soporta ->change() de forma
 * nativa para este caso. Por eso se usa SQL específico por driver.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (Schema::getConnection()->getDriverName() === 'sqlite') {
            Schema::table('reports', function (Blueprint $table) {
                $table->enum('status', ['pending', 'resolved', 'canceled'])
                    ->default('pending')
                    ->change();
            });

            return;
        }

        DB::statement('ALTER TABLE reports DROP CONSTRAINT IF EXISTS reports_status_check');
        DB::statement("ALTER TABLE reports ADD CONSTRAINT reports_status_check CHECK (status IN ('pending','resolved','canceled'))");
    }

    public function down(): void
    {
        if (Schema::getConnection()->getDriverName() === 'sqlite') {
            Schema::table('reports', function (Blueprint $table) {
                $table->enum('status', ['pending', 'in_review', 'resolved'])
                    ->default('pending')
                    ->change();
            });

            return;
        }

        DB::statement('ALTER TABLE reports DROP CONSTRAINT IF EXISTS reports_status_check');
        DB::statement("ALTER TABLE reports ADD CONSTRAINT reports_status_check CHECK (status IN ('pending','in_review','resolved'))");
    }
};
