<?php

namespace Tests\Feature;

use App\Models\Landlords;
use App\Models\StorePrices;
use App\Models\StoreRooms;
use Illuminate\Foundation\Testing\RefreshDatabase;
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

    private function roomPricedAt(float $monthlyPrice, bool $disponibility = true, string $mode = 'month'): StoreRooms
    {
        $landlord = Landlords::factory()->create();
        $room = StoreRooms::factory()->create(['landlord_id' => $landlord->id]);

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
}
