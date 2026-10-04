<?php

namespace Tests\Feature;

use App\Http\Controllers\StoreDisponibilityController;
use App\Models\Landlords;
use App\Models\StoreDisponibility;
use App\Models\StoreRooms;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Route;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

/**
 * The public GET /storeDisponibility/{id} leaked any landlord's block dates to
 * anonymous callers and has no frontend consumer, so it was removed. PUT and
 * DELETE still match the URI, so a GET is answered 405 by the router before any
 * middleware (never 401, even anonymous).
 */
class StoreDisponibilityShowRemovedTest extends TestCase
{
    use RefreshDatabase;

    public function test_route_surface_keeps_only_the_authenticated_actions(): void
    {
        $routes = collect(Route::getRoutes()->getRoutes())
            ->filter(fn ($route) => str_starts_with($route->uri(), 'api/storeDisponibility'));

        $surface = $routes
            ->map(fn ($route) => implode('|', $route->methods()).' '.$route->uri())
            ->sort()
            ->values()
            ->all();

        $this->assertSame([
            'DELETE api/storeDisponibility/{id}',
            'GET|HEAD api/storeDisponibility',
            'POST api/storeDisponibility',
            'PUT api/storeDisponibility/{id}',
        ], $surface);

        foreach ($routes as $route) {
            $this->assertContains('auth.api:sanctum', $route->gatherMiddleware());
        }
    }

    #[DataProvider('callerProvider')]
    public function test_get_by_id_is_405_and_never_exposes_the_block(?string $role): void
    {
        $block = $this->makeBlock();
        $caller = $this->callerAs($role);

        $response = $caller->getJson("/api/storeDisponibility/{$block->id}");

        $this->assertStringNotContainsString('2026-10-01', $response->getContent());
        $response->assertStatus(405);
    }

    public function test_show_action_is_removed_and_the_others_stay(): void
    {
        $this->assertFalse(method_exists(StoreDisponibilityController::class, 'show'));
        foreach (['index', 'store', 'update', 'destroy'] as $method) {
            $this->assertTrue(method_exists(StoreDisponibilityController::class, $method), $method);
        }
    }

    public static function callerProvider(): array
    {
        return [
            'anonymous' => [null],
            'tenant' => ['tenant'],
            'admin' => ['admin'],
        ];
    }

    private function makeBlock(): StoreDisponibility
    {
        $user = User::factory()->create(['role' => 'landlord']);
        $landlord = Landlords::factory()->create(['user_id' => $user->id]);
        $room = StoreRooms::factory()->create(['landlord_id' => $landlord->id]);

        return StoreDisponibility::create([
            'store_room_id' => $room->id,
            'start_date' => '2026-10-01',
            'end_date' => '2026-10-10',
        ]);
    }

    private function callerAs(?string $role): static
    {
        if ($role === null) {
            return $this;
        }

        return $this->actingAs(User::factory()->create(['role' => $role]), 'sanctum');
    }
}
