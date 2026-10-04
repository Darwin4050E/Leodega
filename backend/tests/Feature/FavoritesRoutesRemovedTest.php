<?php

namespace Tests\Feature;

use App\Models\Favorites;
use App\Models\StoreRooms;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

/**
 * sdd/sanctum-crud-ownership-audit-b: the generic /api/favorites CRUD is gone.
 * No verb is left on /favorites, so the router answers 404 before any middleware
 * (never 401, even anonymous).
 */
class FavoritesRoutesRemovedTest extends TestCase
{
    use RefreshDatabase;

    public function test_no_favorites_route_is_registered()
    {
        $uris = collect(Route::getRoutes()->getRoutes())
            ->map(fn ($route) => $route->uri())
            ->filter(fn ($uri) => str_starts_with($uri, 'api/favorites'));

        $this->assertSame([], $uris->values()->all());
    }

    public function test_every_verb_returns_404_for_every_caller_and_changes_nothing()
    {
        [$id, $roomId] = $this->seedFavorite();
        $body = ['user_id' => User::factory()->create()->id, 'store_room_id' => $roomId];
        $before = DB::table('favorites')->get()->all();

        $statuses = [];
        foreach ([null, 'tenant', 'admin'] as $role) {
            $caller = $role ? $this->actingAs(User::factory()->create(['role' => $role]), 'sanctum') : $this;
            foreach ([['GET', ''], ['POST', ''], ['GET', "/{$id}"], ['PUT', "/{$id}"], ['DELETE', "/{$id}"]] as [$method, $suffix]) {
                $statuses[($role ?? 'anonymous')." {$method} {$suffix}"] = $caller->json($method, "/api/favorites{$suffix}", $body)->status();
            }
        }

        $this->assertEquals($before, DB::table('favorites')->get()->all());
        $this->assertSame(array_fill_keys(array_keys($statuses), 404), $statuses);
    }

    public function test_post_cannot_forge_a_favorite_for_another_user()
    {
        $room = StoreRooms::factory()->create();
        $victim = User::factory()->create();

        $response = $this->actingAs(User::factory()->create(), 'sanctum')->postJson('/api/favorites', [
            'user_id' => $victim->id,
            'store_room_id' => $room->id,
        ]);

        $this->assertDatabaseMissing('favorites', ['user_id' => $victim->id]);
        $response->assertStatus(404);
    }

    public function test_stranger_cannot_edit_or_delete_another_users_favorite()
    {
        [$id, $roomId, $ownerId] = $this->seedFavorite();
        $stranger = User::factory()->create();
        $this->actingAs($stranger, 'sanctum');

        $put = $this->putJson("/api/favorites/{$id}", ['user_id' => $stranger->id, 'store_room_id' => StoreRooms::factory()->create()->id]);
        $delete = $this->deleteJson("/api/favorites/{$id}");

        $this->assertDatabaseHas('favorites', ['id' => $id, 'user_id' => $ownerId, 'store_room_id' => $roomId]);
        $this->assertSame([404, 404], [$put->status(), $delete->status()]);
    }

    public function test_authenticated_index_does_not_leak_favorites()
    {
        [, $roomId] = $this->seedFavorite();

        $response = $this->actingAs(User::factory()->create(), 'sanctum')->getJson('/api/favorites');

        $response->assertDontSee('"store_room_id":'.$roomId, false);
        $response->assertStatus(404);
    }

    public function test_dead_code_is_removed_and_model_is_kept()
    {
        $this->assertFileDoesNotExist(app_path('Http/Controllers/FavoritesController.php'));
        $this->assertFileDoesNotExist(app_path('Http/Requests/StoreFavoriteRequest.php'));
        $this->assertFileDoesNotExist(app_path('Http/Requests/UpdateFavoriteRequest.php'));
        $this->assertFileExists(app_path('Models/Favorites.php'));
        $this->assertTrue(Schema::hasTable((new Favorites)->getTable()));
    }

    /**
     * @return array{0: int, 1: int, 2: int} favorite id, store room id, owner user id
     */
    private function seedFavorite(): array
    {
        $owner = User::factory()->create();
        $room = StoreRooms::factory()->create();
        $id = DB::table('favorites')->insertGetId([
            'user_id' => $owner->id,
            'store_room_id' => $room->id,
            'save_date' => now()->toDateString(),
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        return [$id, $room->id, $owner->id];
    }
}
