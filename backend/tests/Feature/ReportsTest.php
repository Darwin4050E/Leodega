<?php

namespace Tests\Feature;

use App\Http\Controllers\ReportsController;
use App\Models\Reports;
use App\Models\StoreRooms;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Route;
use PHPUnit\Framework\Attributes\DataProvider;
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

    #[DataProvider('nonAdminRoleProvider')]
    public function test_non_admin_cannot_read_reports(string $role)
    {
        $report = Reports::factory()->create(['title' => 'Reporte privado']);

        $index = $this->callerAs($role)->getJson('/api/reports');
        $show = $this->callerAs($role)->getJson("/api/reports/{$report->id}");

        $index->assertStatus(403);
        $show->assertStatus(403);
        $this->assertStringNotContainsString('Reporte privado', $index->getContent());
        $this->assertStringNotContainsString('Reporte privado', $show->getContent());
    }

    public function test_anonymous_cannot_read_reports()
    {
        $report = Reports::factory()->create();

        $this->getJson('/api/reports')->assertStatus(401);
        $this->getJson("/api/reports/{$report->id}")->assertStatus(401);
    }

    public function test_admin_can_read_reports()
    {
        $report = Reports::factory()->create(['title' => 'Reporte visible']);

        $index = $this->callerAs('admin')->getJson('/api/reports');
        $show = $this->callerAs('admin')->getJson("/api/reports/{$report->id}");

        $index->assertStatus(200);
        $listed = collect($index->json())->firstWhere('id', $report->id);
        $this->assertSame('Reporte visible', $listed['title']);
        $this->assertSame($report->user_id, $listed['user']['id']);

        $show->assertStatus(200);
        $show->assertJsonPath('report.id', $report->id);
    }

    #[DataProvider('callerRoleProvider')]
    public function test_removed_put_verb_returns_405(?string $role)
    {
        $reportedUser = User::factory()->create();
        $report = Reports::factory()->create(['title' => 'Original', 'status' => 'pending']);

        $response = $this->callerAs($role)->putJson("/api/reports/{$report->id}", [
            'title' => 'Alterado',
            'status' => 'canceled',
            'reported_user_id' => $reportedUser->id,
        ]);

        $response->assertStatus(405);
        $this->assertStringContainsString('GET', (string) $response->headers->get('Allow'));
        $this->assertDatabaseHas('reports', [
            'id' => $report->id,
            'title' => 'Original',
            'status' => 'pending',
            'reported_user_id' => null,
        ]);
    }

    public function test_reports_route_surface()
    {
        $routes = collect(Route::getRoutes()->getRoutes())
            ->filter(fn ($route) => str_starts_with($route->uri(), 'api/reports'));

        $surface = $routes
            ->map(fn ($route) => implode('|', $route->methods()).' '.$route->uri())
            ->sort()
            ->values()
            ->all();

        $this->assertSame([
            'GET|HEAD api/reports',
            'GET|HEAD api/reports/{id}',
            'PATCH api/reports/{report}/status',
            'POST api/reports',
        ], $surface);

        $this->assertCount(4, $routes);
        foreach ($routes as $route) {
            $this->assertContains('auth.api:sanctum', $route->gatherMiddleware());
        }

        $isPost = fn ($route) => in_array('POST', $route->methods(), true);

        $adminOnly = $routes->reject($isPost);
        $this->assertCount(3, $adminOnly);
        foreach ($adminOnly as $route) {
            $this->assertContains('role:admin', $route->gatherMiddleware());
        }

        $create = $routes->filter($isPost);
        $this->assertCount(1, $create);
        $this->assertNotContains('role:admin', $create->first()->gatherMiddleware());

        $this->assertFalse(method_exists(ReportsController::class, 'update'));
        $this->assertFalse(method_exists(ReportsController::class, 'destroy'));
        foreach (['index', 'show', 'store', 'updateStatus'] as $method) {
            $this->assertTrue(method_exists(ReportsController::class, $method), $method);
        }
        $this->assertFileDoesNotExist(app_path('Http/Requests/UpdateReportRequest.php'));
    }

    public static function callerRoleProvider(): array
    {
        return [
            'anonymous' => [null],
            'tenant' => ['tenant'],
            'landlord' => ['landlord'],
            'admin' => ['admin'],
        ];
    }

    public static function nonAdminRoleProvider(): array
    {
        return [
            'tenant' => ['tenant'],
            'landlord' => ['landlord'],
        ];
    }

    private function callerAs(?string $role): static
    {
        if ($role === null) {
            return $this;
        }

        return $this->actingAs(User::factory()->create(['role' => $role]), 'sanctum');
    }
}
