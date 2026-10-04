<?php

namespace Tests\Feature;

use App\Http\Controllers\StorePricesController;
use App\Models\Landlords;
use App\Models\StorePrices;
use App\Models\StoreRooms;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Route;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

/**
 * sdd/sanctum-crud-ownership-audit-c: the generic storePrices write routes are
 * gone. Price rows are created over HTTP only through the StoreRoomService flow
 * (POST /storeRooms). A GET still matches each URI, so the router answers 405
 * before any middleware (never 401, even anonymous). The public reads stay.
 */
class StorePricesRoutesRemovedTest extends TestCase
{
    use RefreshDatabase;

    public function test_anonymous_index_lists_the_rows(): void
    {
        $prices = StorePrices::factory()->count(2)->create();

        $response = $this->getJson('/api/storePrices');

        $response->assertStatus(200);
        $response->assertJsonCount(2);
        $this->assertEqualsCanonicalizing(
            $prices->pluck('id')->all(),
            collect($response->json())->pluck('id')->all(),
        );
    }

    public function test_anonymous_show_returns_that_row(): void
    {
        $price = StorePrices::factory()->create(['price' => 321]);
        StorePrices::factory()->create(['price' => 654]);

        $response = $this->getJson("/api/storePrices/{$price->id}");

        $response->assertStatus(200);
        $response->assertJsonPath('id', $price->id);
        $response->assertJsonPath('store_room_id', $price->store_room_id);
    }

    public function test_show_of_a_missing_row_is_404(): void
    {
        $response = $this->getJson('/api/storePrices/999999');

        $response->assertStatus(404);
    }

    public static function writeVerbProvider(): iterable
    {
        $callers = [
            'anonymous' => null,
            'tenant' => 'tenant',
            'non-owner landlord' => 'landlord',
            'admin' => 'admin',
        ];

        foreach ($callers as $caller => $role) {
            foreach (['POST', 'PUT', 'DELETE'] as $method) {
                yield "{$caller} {$method}" => [$role, $method];
            }
        }
    }

    #[DataProvider('writeVerbProvider')]
    public function test_write_verbs_return_405_and_leave_rows_untouched(?string $role, string $method): void
    {
        $target = StorePrices::factory()->create(['price' => 100]);
        $otherRoom = StoreRooms::factory()->create();
        $before = $this->snapshot();
        $uri = $method === 'POST' ? '/api/storePrices' : "/api/storePrices/{$target->id}";
        $body = match ($method) {
            'POST' => ['store_room_id' => $otherRoom->id, 'mode' => 'month', 'price' => 99],
            'PUT' => ['price' => 1, 'store_id' => $otherRoom->id],
            default => [],
        };

        $response = $this->callerAs($role)->json($method, $uri, $body);

        $this->assertSame($before, $this->snapshot());
        $response->assertStatus(405);
    }

    public function test_store_prices_route_surface(): void
    {
        $routes = collect(Route::getRoutes()->getRoutes())
            ->filter(fn ($route) => str_starts_with($route->uri(), 'api/storePrices'));

        $surface = $routes
            ->map(fn ($route) => implode('|', $route->methods()).' '.$route->uri())
            ->sort()
            ->values()
            ->all();

        $this->assertSame([
            'GET|HEAD api/storePrices',
            'GET|HEAD api/storePrices/{id}',
        ], $surface);

        foreach ($routes as $route) {
            $this->assertNotContains('auth.api:sanctum', $route->gatherMiddleware());
        }
    }

    public function test_store_prices_dead_code_removed(): void
    {
        $this->assertFileDoesNotExist(app_path('Http/Requests/UpdateStorePricesRequest.php'));
        $this->assertFileExists(app_path('Http/Requests/StoreStorePricesRequest.php'));

        foreach (['index', 'show'] as $method) {
            $this->assertTrue(method_exists(StorePricesController::class, $method), $method);
        }
        foreach (['store', 'update', 'destroy'] as $method) {
            $this->assertFalse(method_exists(StorePricesController::class, $method), $method);
        }
    }

    private function callerAs(?string $role): static
    {
        if ($role === null) {
            return $this;
        }

        $user = User::factory()->create(['role' => $role]);
        if ($role === 'landlord') {
            Landlords::factory()->create(['user_id' => $user->id]);
        }

        return $this->actingAs($user, 'sanctum');
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function snapshot(): array
    {
        return DB::table('store_prices')->orderBy('id')->get()->map(fn ($row) => (array) $row)->all();
    }
}
