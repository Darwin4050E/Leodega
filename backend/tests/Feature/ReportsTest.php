<?php

namespace Tests\Feature;

use App\Models\Reports;
use App\Models\StoreRooms;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ReportsTest extends TestCase
{
    use RefreshDatabase;

    /** @test */
    public function user_can_create_report()
    {
        $user = User::factory()->create(['role' => 'tenant']);
        $store = StoreRooms::factory()->create();

        $response = $this->actingAs($user, 'sanctum')
            ->postJson('/api/reports', [
                'store_id' => $store->id,
                'title' => 'Problema con la bodega',
                'priority' => 'high',
                'report_type' => 'store',
                'description' => 'La bodega no coincide con la descripción publicada.',
            ]);

        $response->assertStatus(201);

        $this->assertDatabaseHas('reports', [
            'store_id' => $store->id,
            'user_id' => $user->id,
            'status' => 'pending',
        ]);
    }

    /** @test */
    public function admin_can_resolve_report()
    {
        $admin = User::factory()->create(['role' => 'admin']);
        $report = Reports::factory()->create([
            'status' => 'pending',
        ]);

        $response = $this->actingAs($admin, 'sanctum')
            ->patchJson("/api/reports/{$report->id}/status", [
                'status' => 'resolved',
            ]);

        $response->assertStatus(200)
            ->assertJsonFragment([
                'status' => 'resolved',
            ]);

        $this->assertDatabaseHas('reports', [
            'id' => $report->id,
            'status' => 'resolved',
        ]);
    }

    /**
     * Fase 2: el check `if ($request->user()->role !== 'admin')` que vivía
     * dentro de updateStatus() se movió a middleware de ruta (role:admin),
     * igual que el resto de endpoints admin-only de la Fase 0.5.
     */
    public function test_non_admin_cannot_resolve_report()
    {
        $landlord = User::factory()->create(['role' => 'landlord']);
        $report = Reports::factory()->create(['status' => 'pending']);

        $response = $this->actingAs($landlord, 'sanctum')
            ->patchJson("/api/reports/{$report->id}/status", [
                'status' => 'resolved',
            ]);

        $response->assertStatus(403);
        $this->assertDatabaseHas('reports', [
            'id' => $report->id,
            'status' => 'pending',
        ]);
    }

    /**
     * Corrección de inconsistencia (ver PLAN_CORRECCION_INCONSISTENCIAS.md, Fase 1.1):
     * la migración original declaraba enum('status', ['pending','in_review','resolved']),
     * pero updateStatus() escribe 'canceled', valor fuera de ese enum. Verificado
     * antes de esta corrección que el INSERT/UPDATE fallaba tanto en SQLite como en
     * PostgreSQL real (no solo en producción, como se documentó inicialmente por error).
     * La migración 2026_08_14_000001_fix_reports_status_enum corrige el CHECK constraint.
     */
    public function test_admin_can_cancel_report_with_status_outside_original_enum()
    {
        $admin = User::factory()->create(['role' => 'admin']);
        $report = Reports::factory()->create(['status' => 'pending']);

        $response = $this->actingAs($admin, 'sanctum')
            ->patchJson("/api/reports/{$report->id}/status", [
                'status' => 'canceled',
                'cancelation_reason' => 'Reporte duplicado',
            ]);

        $response->assertStatus(200)
            ->assertJsonFragment(['status' => 'canceled']);

        $this->assertDatabaseHas('reports', [
            'id' => $report->id,
            'status' => 'canceled',
        ]);
    }

    /**
     * Fase 1: `reported_user_id` validaba contra `exists:users,id` (tabla
     * muerta, hallazgo #4 de la matriz de riesgo) en vez de `user,id`. Al ser
     * `nullable`, solo fallaba cuando el campo realmente se enviaba — este
     * test prueba justo ese caso, ahora corregido.
     */
    public function test_update_accepts_a_real_reported_user_id()
    {
        $admin = User::factory()->create(['role' => 'admin']);
        $reportedUser = User::factory()->create();
        $report = Reports::factory()->create();

        $response = $this->actingAs($admin, 'sanctum')
            ->putJson("/api/reports/{$report->id}", [
                'reported_user_id' => $reportedUser->id,
            ]);

        $response->assertStatus(200);
        $this->assertDatabaseHas('reports', [
            'id' => $report->id,
            'reported_user_id' => $reportedUser->id,
        ]);
    }
}
