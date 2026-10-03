<?php

namespace Tests\Feature;

use App\Models\Landlords;
use App\Models\StorePrices;
use App\Models\StoreRooms;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

/**
 * Covers the public `GET /store-rooms/{id}/quote` endpoint. The endpoint
 * calls `ReservationPricingService::quote()` verbatim (obs #288/#306) — it
 * never recomputes or approximates any figure. `ReservationPricingException`
 * is left uncaught here, mirroring `ReservationsController::store()`, so its
 * own `render()` produces the 422 shape.
 */
class StoreRoomQuoteTest extends TestCase
{
    use RefreshDatabase;

    private const NOT_FOUND = ['message' => 'Bodega no encontrada'];

    private const QUOTE = [
        'rent_subtotal' => '780.00',
        'service_fee' => '46.80',
        'deposit' => '0.00',
        'total_mount' => '780.00',
    ];

    private const QUERY = '?start_date=2026-01-01&end_date=2026-02-01';

    private function roomPricedAt(
        float $monthlyPrice,
        bool $disponibility = true,
        string $mode = 'month',
        string $status = 'approved',
        ?Landlords $landlord = null,
    ): StoreRooms {
        $landlord ??= Landlords::factory()->create();
        $room = StoreRooms::factory()->create([
            'landlord_id' => $landlord->id,
            'publication_status' => $status,
        ]);

        StorePrices::factory()->create([
            'store_room_id' => $room->id,
            'mode' => $mode,
            'price' => $monthlyPrice,
            'disponibility' => $disponibility,
        ]);

        return $room;
    }

    public function test_returns_the_exact_quote_from_the_pricing_service_for_an_eligible_room(): void
    {
        $room = $this->roomPricedAt(780);

        $response = $this->getJson("/api/store-rooms/{$room->id}/quote?start_date=2026-01-01&end_date=2026-02-01");

        $response->assertStatus(200);
        $response->assertExactJson([
            'rent_subtotal' => '780.00',
            'service_fee' => '46.80',
            'deposit' => '0.00',
            'total_mount' => '780.00',
        ]);
    }

    public function test_returns_404_for_an_unknown_storeroom(): void
    {
        $response = $this->getJson('/api/store-rooms/999999/quote?start_date=2026-01-01&end_date=2026-02-01');

        $response->assertStatus(404);
        $response->assertExactJson(['message' => 'Bodega no encontrada']);
    }

    public function test_returns_422_when_no_eligible_month_price_exists(): void
    {
        $room = $this->roomPricedAt(50, true, 'day');

        $response = $this->getJson("/api/store-rooms/{$room->id}/quote?start_date=2026-01-01&end_date=2026-02-01");

        $response->assertStatus(422);
        $response->assertExactJson(['message' => 'No hay un precio mensual disponible para esta bodega.']);
    }

    public function test_is_reachable_without_an_authorization_header(): void
    {
        $room = $this->roomPricedAt(780);

        $response = $this->withHeaders(['Authorization' => ''])
            ->getJson("/api/store-rooms/{$room->id}/quote?start_date=2026-01-01&end_date=2026-02-01");

        $response->assertStatus(200);
    }

    public function test_defaults_to_a_three_month_range_when_no_dates_are_supplied(): void
    {
        $room = $this->roomPricedAt(780);

        $response = $this->getJson("/api/store-rooms/{$room->id}/quote");

        $response->assertStatus(200);
        $response->assertJson([
            'rent_subtotal' => '2340.00',
            'total_mount' => '2340.00',
        ]);
    }

    /**
     * Real Bearer token, no `actingAs`: `actingAs($u, 'sanctum')` makes sanctum
     * the default guard in tests while production defaults to `web`, so only a
     * token request proves quote() resolves the viewer with auth('sanctum').
     * One request per test method keeps the memoized guard from leaking.
     */
    private function bearerAs(User $user): static
    {
        $this->app['auth']->forgetGuards();

        return $this->withToken($user->createToken('auth_token')->plainTextToken);
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

        return $this->bearerAs($user);
    }

    public static function hiddenRoomProvider(): array
    {
        return [
            'anonymous pending' => [null, 'pending'],
            'tenant rejected' => ['tenant', 'rejected'],
            'non-owner landlord pending' => ['landlord', 'pending'],
        ];
    }

    #[DataProvider('hiddenRoomProvider')]
    public function test_hidden_room_returns_the_exact_404_without_pricing_data(?string $role, string $status): void
    {
        $room = $this->roomPricedAt(780, status: $status);

        $response = $this->callerAs($role)->getJson("/api/store-rooms/{$room->id}/quote".self::QUERY);

        $response->assertStatus(404);
        $response->assertExactJson(self::NOT_FOUND);
        $response->assertJsonMissingPath('rent_subtotal');
        $response->assertJsonMissingPath('total_mount');
    }

    public function test_visibility_is_decided_before_date_validation(): void
    {
        $room = $this->roomPricedAt(780, status: 'pending');

        $response = $this->callerAs('tenant')
            ->getJson("/api/store-rooms/{$room->id}/quote?start_date=2026-02-01&end_date=2026-01-01");

        $response->assertStatus(404);
        $response->assertExactJson(self::NOT_FOUND);
    }

    public function test_owning_landlord_quotes_own_pending_room(): void
    {
        $ownerUser = User::factory()->create(['role' => 'landlord']);
        $owner = Landlords::factory()->create(['user_id' => $ownerUser->id]);
        $room = $this->roomPricedAt(780, status: 'pending', landlord: $owner);

        $response = $this->bearerAs($ownerUser)->getJson("/api/store-rooms/{$room->id}/quote".self::QUERY);

        $response->assertStatus(200);
        $response->assertExactJson(self::QUOTE);
    }

    public function test_admin_quotes_a_pending_room(): void
    {
        $room = $this->roomPricedAt(780, status: 'pending');

        $response = $this->callerAs('admin')->getJson("/api/store-rooms/{$room->id}/quote".self::QUERY);

        $response->assertStatus(200);
        $response->assertExactJson(self::QUOTE);
    }

    public function test_approved_room_with_invalid_dates_is_422(): void
    {
        $room = $this->roomPricedAt(780);

        $response = $this->getJson("/api/store-rooms/{$room->id}/quote?start_date=2026-02-01&end_date=2026-01-01");

        $response->assertStatus(422);
        $response->assertJsonValidationErrors(['end_date']);
    }
}
