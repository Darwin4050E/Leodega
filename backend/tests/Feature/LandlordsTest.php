<?php

namespace Tests\Feature;

use App\Http\Controllers\LandlordsController;
use App\Models\CancelationsPolices;
use App\Models\Landlords;
use App\Models\Payments;
use App\Models\Reservations;
use App\Models\StoreRooms;
use App\Models\Tenants;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\Schema;
use PHPUnit\Framework\Attributes\DataProvider;
use ReflectionClass;
use Tests\TestCase;

class LandlordsTest extends TestCase
{
    use RefreshDatabase;

    private const AFFECTED_TABLES = ['landlords', 'storeRooms', 'reservations', 'payments', 'cancelations_polices'];

    // GET se mantiene público: se usa en fichas de bodega públicas.
    public function test_index_returns_landlords_without_authentication()
    {
        Landlords::factory()->count(2)->create();

        $response = $this->getJson('/api/landlords');

        $response->assertStatus(200);
        $response->assertJsonCount(2);
    }

    public function test_show_returns_the_landlord_without_authentication()
    {
        Landlords::factory()->create();
        $landlord = Landlords::factory()->create(['optional_company' => 'Bodegas SA']);

        $response = $this->getJson("/api/landlords/{$landlord->id}");

        $response->assertStatus(200);
        $response->assertJsonPath('id', $landlord->id);
        $response->assertJsonPath('optional_company', 'Bodegas SA');
    }

    public function test_show_returns_404_for_a_missing_landlord()
    {
        $response = $this->getJson('/api/landlords/999999');

        $response->assertStatus(404);
    }

    /**
     * sdd/sanctum-crud-ownership-audit-b: landlord rows are created only by
     * UserRegistrationService; the generic write verbs are gone. GET shares
     * the URI, so the router answers 405 before any middleware (never 401).
     */
    #[DataProvider('removedWriteVerbProvider')]
    public function test_removed_write_verbs_return_405(?string $role, string $method)
    {
        $landlord = $this->seedLandlordGraph()['landlord'];
        $newUser = User::factory()->create(['role' => 'landlord']);
        $before = $this->snapshot(self::AFFECTED_TABLES);

        $uri = $method === 'POST' ? '/api/landlords' : "/api/landlords/{$landlord->id}";
        $response = $this->callerAs($role)->json($method, $uri, [
            'user_id' => $newUser->id,
            'optional_company' => 'Forged',
        ]);

        $this->assertSame($before, $this->snapshot(self::AFFECTED_TABLES));
        $response->assertStatus(405);
        $this->assertStringContainsString('GET', (string) $response->headers->get('Allow'));
    }

    public function test_put_cannot_hijack_a_landlord_to_another_user()
    {
        $graph = $this->seedLandlordGraph();
        $victim = $graph['landlord'];
        $attacker = User::factory()->create(['role' => 'tenant']);

        $response = $this->actingAs($attacker, 'sanctum')->putJson("/api/landlords/{$victim->id}", [
            'user_id' => $attacker->id,
        ]);

        $this->assertDatabaseHas('landlords', ['id' => $victim->id, 'user_id' => $victim->user_id]);
        $this->assertDatabaseHas('storeRooms', [
            'id' => $graph['room']->id,
            'landlord_id' => $victim->id,
        ]);
        $response->assertStatus(405);
    }

    public function test_delete_cannot_cascade_through_a_landlord()
    {
        $graph = $this->seedLandlordGraph();
        $stranger = User::factory()->create(['role' => 'tenant']);

        $response = $this->actingAs($stranger, 'sanctum')->deleteJson("/api/landlords/{$graph['landlord']->id}");

        $this->assertDatabaseHas('landlords', ['id' => $graph['landlord']->id]);
        $this->assertDatabaseHas('storeRooms', ['id' => $graph['room']->id]);
        $this->assertDatabaseHas('reservations', ['id' => $graph['reservation']->id]);
        $this->assertDatabaseHas('payments', ['id' => $graph['payment']->id]);
        $response->assertStatus(405);
    }

    public function test_post_cannot_forge_an_approved_room_through_nested_store_rooms()
    {
        $attacker = User::factory()->create(['role' => 'tenant']);
        $victimUser = User::factory()->create(['role' => 'landlord']);
        $before = $this->snapshot(['landlords', 'storeRooms']);

        $response = $this->actingAs($attacker, 'sanctum')->postJson('/api/landlords', [
            'user_id' => $victimUser->id,
            'storeRooms' => [[
                'room_type' => 'bodega',
                'storage_type' => 'completa',
                'direction' => 'Av. Falsa 123',
                'city' => 'Guayaquil',
                'size' => 30,
                'title' => 'Sala forjada',
                'description' => 'Forjada sin moderacion',
                'security' => '{}',
                'publication_status' => 'approved',
            ]],
        ]);

        $this->assertSame($before, $this->snapshot(['landlords', 'storeRooms']));
        $this->assertDatabaseMissing('landlords', ['user_id' => $victimUser->id]);
        $response->assertStatus(405);
    }

    public function test_landlords_route_surface()
    {
        $routes = collect(Route::getRoutes()->getRoutes())
            ->filter(fn ($route) => str_starts_with($route->uri(), 'api/landlords'));

        $surface = $routes
            ->map(fn ($route) => implode('|', $route->methods()).' '.$route->uri())
            ->sort()
            ->values()
            ->all();

        $this->assertSame([
            'GET|HEAD api/landlords',
            'GET|HEAD api/landlords/{id}',
            'GET|HEAD api/landlords/{id}/storeRooms',
        ], $surface);

        $publicReads = $routes->filter(fn ($route) => in_array($route->uri(), ['api/landlords', 'api/landlords/{id}'], true));
        $this->assertCount(2, $publicReads);
        foreach ($publicReads as $route) {
            $this->assertNotContains('auth.api:sanctum', $route->gatherMiddleware());
        }
    }

    public function test_landlords_dead_code_removed()
    {
        $declared = collect((new ReflectionClass(LandlordsController::class))->getMethods())
            ->filter(fn ($method) => $method->class === LandlordsController::class)
            ->map(fn ($method) => $method->name)
            ->sort()
            ->values()
            ->all();

        $this->assertSame(['index', 'show'], $declared);
        $this->assertFileDoesNotExist(app_path('Http/Requests/StoreLandlordRequest.php'));
        $this->assertFileDoesNotExist(app_path('Http/Requests/UpdateLandlordRequest.php'));

        $this->assertFileExists(app_path('Models/Landlords.php'));
        $this->assertFileExists(app_path('Models/Tenants.php'));
        $this->assertTrue(Schema::hasTable((new Landlords)->getTable()));
        $this->assertTrue(Schema::hasTable((new Tenants)->getTable()));
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

    public static function removedWriteVerbProvider(): iterable
    {
        foreach (self::callerRoleProvider() as $caller => [$role]) {
            foreach (['POST', 'PUT', 'DELETE'] as $method) {
                yield "{$caller} {$method}" => [$role, $method];
            }
        }
    }

    private function callerAs(?string $role): static
    {
        if ($role === null) {
            return $this;
        }

        return $this->actingAs(User::factory()->create(['role' => $role]), 'sanctum');
    }

    /**
     * @return array<string, mixed>
     */
    private function seedLandlordGraph(): array
    {
        $landlord = Landlords::factory()->create();
        $room = StoreRooms::factory()->approved()->create(['landlord_id' => $landlord->id]);
        $reservation = Reservations::factory()->create(['store_room_id' => $room->id]);
        $payment = Payments::factory()->create(['reservation_id' => $reservation->id]);
        $policy = CancelationsPolices::create([
            'landlord_id' => $landlord->id,
            'policy_name' => 'Flexible',
            'description' => 'Reembolso total',
        ]);

        return compact('landlord', 'room', 'reservation', 'payment', 'policy');
    }

    /**
     * @param  array<int, string>  $tables
     * @return array<string, array<int, array<string, mixed>>>
     */
    private function snapshot(array $tables): array
    {
        $rows = [];
        foreach ($tables as $table) {
            $rows[$table] = DB::table($table)->orderBy('id')->get()->map(fn ($row) => (array) $row)->all();
        }

        return $rows;
    }
}
