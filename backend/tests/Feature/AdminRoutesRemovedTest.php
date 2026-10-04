<?php

namespace Tests\Feature;

use App\Models\Admin;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\Schema;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

/**
 * The /admin routes wrote the separate Admin profile model, never user
 * accounts, so they were removed together with their controller and requests.
 */
class AdminRoutesRemovedTest extends TestCase
{
    use RefreshDatabase;

    public function test_no_route_is_registered_under_api_admin(): void
    {
        $uris = collect(Route::getRoutes()->getRoutes())
            ->map(fn ($route) => $route->uri())
            ->filter(fn (string $uri) => $uri === 'api/admin' || str_starts_with($uri, 'api/admin/'))
            ->values()
            ->all();

        $this->assertSame([], $uris);
    }

    #[DataProvider('adminVerbMatrixProvider')]
    public function test_every_admin_verb_is_404_and_leaves_rows_untouched(?string $role, string $method, string $uri): void
    {
        $caller = $this->callerAs($role);
        $admin = Admin::create(['user_id' => User::factory()->create(['role' => 'admin'])->id, 'admin_level' => 1]);
        $adminBefore = $this->snapshot('admin');
        $userBefore = $this->snapshot('user');

        $response = $caller->json($method, str_replace('{id}', (string) $admin->id, $uri), [
            'user_id' => $admin->user_id,
            'admin_level' => 2,
        ]);

        $this->assertSame($adminBefore, $this->snapshot('admin'));
        $this->assertSame($userBefore, $this->snapshot('user'));
        $response->assertStatus(404);
    }

    public function test_admin_dead_code_is_removed_but_the_model_and_table_stay(): void
    {
        $this->assertFileDoesNotExist(app_path('Http/Controllers/AdminController.php'));
        $this->assertFileDoesNotExist(app_path('Http/Requests/StoreAdminRequest.php'));
        $this->assertFileDoesNotExist(app_path('Http/Requests/UpdateAdminRequest.php'));
        $this->assertFileDoesNotExist(base_path('tests/Feature/AdminTest.php'));
        $this->assertFileExists(app_path('Models/Admin.php'));
        $this->assertTrue(Schema::hasTable((new Admin)->getTable()));
        $this->assertTrue(method_exists(User::class, 'admin'));
    }

    public static function adminVerbMatrixProvider(): array
    {
        $verbs = [
            ['GET', '/api/admin'],
            ['POST', '/api/admin'],
            ['GET', '/api/admin/{id}'],
            ['PUT', '/api/admin/{id}'],
            ['DELETE', '/api/admin/{id}'],
        ];
        $cases = [];
        foreach (['anonymous' => null, 'tenant' => 'tenant', 'landlord' => 'landlord', 'admin' => 'admin'] as $label => $role) {
            foreach ($verbs as [$method, $uri]) {
                $cases["$label $method $uri"] = [$role, $method, $uri];
            }
        }

        return $cases;
    }

    private function callerAs(?string $role): static
    {
        if ($role === null) {
            return $this;
        }

        return $this->actingAs(User::factory()->create(['role' => $role]), 'sanctum');
    }

    private function snapshot(string $table): array
    {
        return DB::table($table)->orderBy('id')->get()->map(fn ($row) => (array) $row)->all();
    }
}
