<?php

namespace Tests\Feature;

use App\Http\Controllers\RatingsController;
use App\Models\Ratings;
use App\Models\StoreRooms;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Route;
use ReflectionClass;
use Tests\TestCase;

class RatingsTest extends TestCase
{
    use RefreshDatabase;

    /** @test */
    public function tenant_can_publish_rating()
    {
        // TC-B-19
        $user = User::factory()->create();
        $storeRoom = StoreRooms::factory()->create();

        $response = $this->actingAs($user, 'sanctum')
            ->postJson('/api/ratings', [
                'store_id' => $storeRoom->id,
                'stars' => 5,
                'comment' => 'Excelente bodega',
            ]);

        $response->assertStatus(201);

        $this->assertDatabaseHas('ratings', [
            'store_id' => $storeRoom->id,
            'user_id' => $user->id,
            'stars' => 5,
        ]);
    }

    /** @test */
    public function store_room_rating_average_is_recalculated()
    {
        // TC-B-20
        $storeRoom = StoreRooms::factory()->create(['publication_status' => 'approved']);

        Ratings::factory()->create([
            'store_id' => $storeRoom->id,
            'stars' => 4,
        ]);

        Ratings::factory()->create([
            'store_id' => $storeRoom->id,
            'stars' => 5,
        ]);

        $response = $this->getJson('/api/storeRooms');

        $response->assertStatus(200)
            ->assertJsonFragment([
                'rating_avg' => 4.5,
            ]);
    }

    /**
     * Fase 3: esta regla vivía inline en el controlador sin ningún test que la
     * cubriera. Ahora vive en RatingsService::create() y queda probada tanto
     * a nivel HTTP (aquí) como a nivel unitario (tests/Unit/RatingsServiceTest.php).
     */
    public function test_cannot_rate_the_same_store_room_twice()
    {
        $user = User::factory()->create();
        $storeRoom = StoreRooms::factory()->create();

        Ratings::factory()->create([
            'store_id' => $storeRoom->id,
            'user_id' => $user->id,
        ]);

        $response = $this->actingAs($user, 'sanctum')
            ->postJson('/api/ratings', [
                'store_id' => $storeRoom->id,
                'stars' => 3,
                'comment' => 'Repetido',
            ]);

        $response->assertStatus(409);
        $response->assertJson(['message' => 'Ya calificaste esta bodega']);
        $this->assertDatabaseCount('ratings', 1);
    }

    public function test_index_requires_store_id_and_summarises_the_ratings_of_a_room()
    {
        $user = User::factory()->create();
        $storeRoom = StoreRooms::factory()->create();
        Ratings::factory()->create(['store_id' => $storeRoom->id, 'stars' => 4]);
        Ratings::factory()->create(['store_id' => $storeRoom->id, 'stars' => 5]);

        $this->actingAs($user, 'sanctum')->getJson('/api/ratings')
            ->assertStatus(400)
            ->assertJson(['message' => 'store_id requerido']);

        $this->actingAs($user, 'sanctum')->getJson("/api/ratings?store_id={$storeRoom->id}")
            ->assertStatus(200)
            ->assertJsonPath('average', 4.5)
            ->assertJsonPath('total', 2)
            ->assertJsonCount(2, 'ratings');
    }

    public function test_anonymous_callers_cannot_read_or_publish_ratings()
    {
        $storeRoom = StoreRooms::factory()->create();

        $this->getJson("/api/ratings?store_id={$storeRoom->id}")->assertStatus(401);
        $this->postJson('/api/ratings', ['store_id' => $storeRoom->id, 'stars' => 5, 'comment' => 'Anon'])
            ->assertStatus(401);
        $this->assertDatabaseCount('ratings', 0);
    }

    /**
     * sdd/sanctum-crud-ownership-audit-b: /ratings/{id} was removed. No verb is
     * left on that URI, so the router answers 404 before any middleware (never
     * 401, even anonymous). The snapshot assert runs first to expose a real write.
     */
    public function test_removed_rating_verbs_return_404_and_change_nothing()
    {
        $rating = Ratings::factory()->create(['stars' => 5, 'comment' => 'Original']);
        $body = ['stars' => 1, 'comment' => 'Forged', 'store_id' => StoreRooms::factory()->create()->id];
        $before = DB::table('ratings')->get()->all();

        $statuses = [];
        foreach ([null, 'tenant', 'admin'] as $role) {
            $caller = $role ? $this->actingAs(User::factory()->create(['role' => $role]), 'sanctum') : $this;
            foreach (['GET', 'PUT', 'DELETE'] as $method) {
                $statuses[($role ?? 'anonymous')." {$method}"] = $caller->json($method, "/api/ratings/{$rating->id}", $body)->status();
            }
        }

        $this->assertEquals($before, DB::table('ratings')->get()->all());
        $this->assertSame(array_fill_keys(array_keys($statuses), 404), $statuses);
    }

    public function test_a_stranger_cannot_edit_or_delete_another_users_rating()
    {
        $storeRoom = StoreRooms::factory()->create(['publication_status' => 'approved']);
        $rating = Ratings::factory()->create(['store_id' => $storeRoom->id, 'stars' => 5, 'comment' => 'Original']);
        $otherRoom = StoreRooms::factory()->create();
        $listingBefore = $this->getJson('/api/storeRooms')->json();
        $stranger = $this->actingAs(User::factory()->create(), 'sanctum');

        $stranger->putJson("/api/ratings/{$rating->id}", ['stars' => 1, 'comment' => 'Forged', 'store_id' => $otherRoom->id]);
        $stranger->deleteJson("/api/ratings/{$rating->id}");

        $this->assertDatabaseHas('ratings', [
            'id' => $rating->id,
            'store_id' => $storeRoom->id,
            'stars' => 5,
            'comment' => 'Original',
        ]);
        $this->assertSame($listingBefore, $this->getJson('/api/storeRooms')->json());
    }

    public function test_rating_detail_does_not_leak_through_the_removed_show_route()
    {
        $rating = Ratings::factory()->create(['comment' => 'RATING-LEAK-MARKER-7f3a']);

        $this->actingAs(User::factory()->create(), 'sanctum')
            ->getJson("/api/ratings/{$rating->id}")
            ->assertDontSee('RATING-LEAK-MARKER-7f3a', false);
    }

    public function test_route_surface_is_index_and_store_behind_sanctum()
    {
        $routes = collect(Route::getRoutes()->getRoutes())
            ->filter(fn ($route) => str_starts_with($route->uri(), 'api/ratings'));

        $this->assertSame(
            ['GET|HEAD api/ratings', 'POST api/ratings'],
            $routes->map(fn ($route) => implode('|', $route->methods()).' '.$route->uri())->sort()->values()->all(),
        );
        $routes->each(fn ($route) => $this->assertContains('auth.api:sanctum', $route->gatherMiddleware()));
    }

    public function test_dead_code_is_removed_and_store_request_is_kept()
    {
        $declared = collect((new ReflectionClass(RatingsController::class))->getMethods())
            ->filter(fn ($method) => $method->class === RatingsController::class)
            ->map(fn ($method) => $method->name)
            ->sort()
            ->values()
            ->all();

        $this->assertSame(['index', 'store'], $declared);
        $this->assertFileDoesNotExist(app_path('Http/Requests/UpdateRatingRequest.php'));
        $this->assertFileExists(app_path('Http/Requests/StoreRatingRequest.php'));
    }
}
