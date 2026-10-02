<?php

namespace Tests\Feature;

use App\Http\Controllers\CancelationsPolicesController;
use App\Models\CancelationsPolices;
use App\Models\Landlords;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\Schema;
use ReflectionClass;
use Tests\TestCase;

/**
 * sdd/sanctum-crud-ownership-audit-b: only the public reads of
 * /cancelations_polices remain. The write verbs are gone; GET shares the URI, so
 * the router answers 405 before any middleware (never 401, even anonymous).
 */
class CancelationsPolicesTest extends TestCase
{
    use RefreshDatabase;

    public function test_index_lists_policies_without_authentication()
    {
        $this->seedPolicy();
        $this->seedPolicy();

        $this->getJson('/api/cancelations_polices')->assertStatus(200)->assertJsonCount(2);
    }

    public function test_show_returns_the_policy_without_authentication()
    {
        $this->seedPolicy();
        $policy = $this->seedPolicy();

        $this->getJson("/api/cancelations_polices/{$policy->id}")
            ->assertStatus(200)
            ->assertJsonPath('id', $policy->id);
    }

    public function test_show_returns_404_for_a_missing_policy()
    {
        $this->getJson('/api/cancelations_polices/999999')->assertStatus(404);
    }

    public function test_removed_write_verbs_return_405_and_change_nothing()
    {
        $policy = $this->seedPolicy();
        $body = [
            'landlord_id' => Landlords::factory()->create()->id,
            'policy_name' => 'Forged',
            'description' => 'Forged',
            'is_default' => true,
        ];
        $before = DB::table('cancelations_polices')->get()->all();

        $statuses = [];
        foreach ([null, 'tenant', 'admin'] as $role) {
            $caller = $role ? $this->actingAs(User::factory()->create(['role' => $role]), 'sanctum') : $this;
            foreach (['POST', 'PUT', 'DELETE'] as $method) {
                $uri = '/api/cancelations_polices'.($method === 'POST' ? '' : "/{$policy->id}");
                $statuses[($role ?? 'anonymous')." {$method}"] = $caller->json($method, $uri, $body)->status();
            }
        }

        $this->assertEquals($before, DB::table('cancelations_polices')->get()->all());
        $this->assertSame(array_fill_keys(array_keys($statuses), 405), $statuses);
    }

    public function test_route_surface_is_two_public_reads()
    {
        $routes = collect(Route::getRoutes()->getRoutes())
            ->filter(fn ($route) => str_starts_with($route->uri(), 'api/cancelations_polices'));

        $this->assertSame(
            ['GET|HEAD api/cancelations_polices', 'GET|HEAD api/cancelations_polices/{id}'],
            $routes->map(fn ($route) => implode('|', $route->methods()).' '.$route->uri())->sort()->values()->all(),
        );
        $routes->each(fn ($route) => $this->assertNotContains('auth.api:sanctum', $route->gatherMiddleware()));
    }

    public function test_dead_code_is_removed_and_model_is_kept()
    {
        $declared = collect((new ReflectionClass(CancelationsPolicesController::class))->getMethods())
            ->filter(fn ($method) => $method->class === CancelationsPolicesController::class)
            ->map(fn ($method) => $method->name)
            ->sort()
            ->values()
            ->all();

        $this->assertSame(['index', 'show'], $declared);
        $this->assertFileDoesNotExist(app_path('Http/Requests/StoreCancelationsPolicesRequest.php'));
        $this->assertFileDoesNotExist(app_path('Http/Requests/UpdateCancelationsPolicesRequest.php'));
        $this->assertFileExists(app_path('Models/CancelationsPolices.php'));
        $this->assertTrue(Schema::hasTable((new CancelationsPolices)->getTable()));
    }

    private function seedPolicy(): CancelationsPolices
    {
        return CancelationsPolices::create([
            'landlord_id' => Landlords::factory()->create()->id,
            'policy_name' => 'Flexible',
            'description' => 'Reembolso total',
        ]);
    }
}
