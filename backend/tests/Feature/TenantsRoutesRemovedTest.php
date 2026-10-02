<?php

namespace Tests\Feature;

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
use Tests\TestCase;

/**
 * sdd/sanctum-crud-ownership-audit-b: the generic /api/tenants CRUD is gone.
 * Tenant rows are created over HTTP only by UserRegistrationService (POST /user),
 * so no verb is left on /tenants and the router answers 404 before any middleware
 * (never 401, even anonymous).
 */
class TenantsRoutesRemovedTest extends TestCase
{
    use RefreshDatabase;

    private const AFFECTED_TABLES = ['tenants', 'reservations', 'payments'];

    private const LEAK_MARKER = 'zz-tenant-marker-7f3a91';

    public function test_no_tenants_route_is_registered()
    {
        $routes = collect(Route::getRoutes()->getRoutes())
            ->filter(fn ($route) => str_starts_with($route->uri(), 'api/tenants'));

        $this->assertSame([], $routes->map(fn ($route) => $route->uri())->values()->all());
        $this->assertNotEmpty(
            collect(Route::getRoutes()->getRoutes())->filter(fn ($route) => $route->uri() === 'api/tenant/reservations')->all(),
            'the prefix check must not swallow the unrelated tenant reservations route',
        );
    }

    #[DataProvider('removedVerbProvider')]
    public function test_removed_verbs_return_404(?string $role, string $method, string $uri)
    {
        $victim = $this->seedTenantGraph()['tenant'];
        $newUser = User::factory()->create(['role' => 'tenant']);
        $before = $this->snapshot(self::AFFECTED_TABLES);

        $response = $this->callerAs($role)->json($method, str_replace('{id}', (string) $victim->id, $uri), [
            'user_id' => $newUser->id,
            'search_preference' => 'forged',
        ]);

        $this->assertSame($before, $this->snapshot(self::AFFECTED_TABLES));
        $response->assertStatus(404);
    }

    public function test_put_cannot_hijack_a_tenant_to_another_user()
    {
        $graph = $this->seedTenantGraph();
        $victim = $graph['tenant'];
        $attacker = User::factory()->create(['role' => 'tenant']);

        $response = $this->actingAs($attacker, 'sanctum')->putJson("/api/tenants/{$victim->id}", [
            'user_id' => $attacker->id,
        ]);

        $this->assertDatabaseHas('tenants', ['id' => $victim->id, 'user_id' => $victim->user_id]);
        $this->assertDatabaseHas('reservations', [
            'id' => $graph['reservation']->id,
            'tenant_id' => $victim->id,
        ]);
        $response->assertStatus(404);
    }

    public function test_post_cannot_forge_a_confirmed_reservation_through_nested_reservations()
    {
        $attacker = User::factory()->create(['role' => 'tenant']);
        $newUser = User::factory()->create(['role' => 'tenant']);
        $room = StoreRooms::factory()->approved()->create();
        $before = $this->snapshot(['tenants', 'reservations']);

        $response = $this->actingAs($attacker, 'sanctum')->postJson('/api/tenants', [
            'user_id' => $newUser->id,
            'search_preference' => 'price',
            'reservations' => [[
                'store_room_id' => $room->id,
                'start_date' => now()->addDays(2)->toDateString(),
                'end_date' => now()->addDays(6)->toDateString(),
                'status' => 'confirmed',
                'total_mount' => 1,
            ]],
        ]);

        $this->assertSame($before, $this->snapshot(['tenants', 'reservations']));
        $this->assertDatabaseMissing('tenants', ['user_id' => $newUser->id]);
        $response->assertStatus(404);
    }

    public function test_delete_cannot_cascade_through_a_tenant()
    {
        $graph = $this->seedTenantGraph();
        $stranger = User::factory()->create(['role' => 'tenant']);

        $response = $this->actingAs($stranger, 'sanctum')->deleteJson("/api/tenants/{$graph['tenant']->id}");

        $this->assertDatabaseHas('tenants', ['id' => $graph['tenant']->id]);
        $this->assertDatabaseHas('reservations', ['id' => $graph['reservation']->id]);
        $this->assertDatabaseHas('payments', ['id' => $graph['payment']->id]);
        $response->assertStatus(404);
    }

    #[DataProvider('readUriProvider')]
    public function test_authenticated_reads_do_not_leak_tenant_data(string $uri)
    {
        $tenant = $this->seedTenantGraph()['tenant'];
        $caller = User::factory()->create(['role' => 'landlord']);

        $response = $this->actingAs($caller, 'sanctum')->getJson(str_replace('{id}', (string) $tenant->id, $uri));

        $response->assertDontSee(self::LEAK_MARKER);
        $response->assertStatus(404);
    }

    public function test_tenants_dead_code_removed()
    {
        $this->assertFileDoesNotExist(app_path('Http/Controllers/TenantsController.php'));
        $this->assertFileDoesNotExist(app_path('Http/Requests/StoreTenantRequest.php'));
        $this->assertFileDoesNotExist(app_path('Http/Requests/UpdateTenantRequest.php'));

        $this->assertFileExists(app_path('Models/Tenants.php'));
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

    public static function removedVerbProvider(): iterable
    {
        $removed = [
            ['GET', '/api/tenants'],
            ['POST', '/api/tenants'],
            ['GET', '/api/tenants/{id}'],
            ['PUT', '/api/tenants/{id}'],
            ['DELETE', '/api/tenants/{id}'],
        ];

        foreach (self::callerRoleProvider() as $caller => [$role]) {
            foreach ($removed as [$method, $uri]) {
                yield "{$caller} {$method} {$uri}" => [$role, $method, $uri];
            }
        }
    }

    public static function readUriProvider(): array
    {
        return [
            'index' => ['/api/tenants'],
            'show' => ['/api/tenants/{id}'],
        ];
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
    private function seedTenantGraph(): array
    {
        $tenant = Tenants::factory()->create(['search_preference' => self::LEAK_MARKER]);
        $reservation = Reservations::factory()->create(['tenant_id' => $tenant->id]);
        $payment = Payments::factory()->create(['reservation_id' => $reservation->id]);

        return compact('tenant', 'reservation', 'payment');
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
