<?php

namespace Tests\Feature;

use App\Models\Landlords;
use App\Models\StorePrices;
use App\Models\StoreRooms;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * HUC-01: filtered/distance-aware `GET /storeRooms` (spec
 * "storage-search"). Covers the three acceptance criteria's backend
 * contract plus the backward-compatibility and null-coordinate edge cases
 * called out in the design's testing strategy.
 */
class StoreRoomSearchTest extends TestCase
{
    use RefreshDatabase;

    private function createApprovedRoom(array $roomAttributes = [], float $monthlyPrice = 1000): StoreRooms
    {
        $landlord = Landlords::factory()->create();

        $room = StoreRooms::factory()->create(array_merge([
            'landlord_id' => $landlord->id,
            'publication_status' => 'approved',
        ], $roomAttributes));

        StorePrices::factory()->create([
            'store_room_id' => $room->id,
            'mode' => 'month',
            'price' => $monthlyPrice,
        ]);

        return $room;
    }

    // -- No-params parity -------------------------------------------------

    public function test_index_without_params_reproduces_prior_behavior(): void
    {
        $room = $this->createApprovedRoom(['city' => 'Guayaquil'], 800);

        $response = $this->getJson('/api/storeRooms');

        $response->assertStatus(200);
        $response->assertJsonFragment([
            'id' => $room->id,
            'title' => $room->title,
            'city' => 'Guayaquil',
        ]);
        $response->assertJsonPath('0.distance_km', null);
    }

    // -- Individual filters -------------------------------------------------

    public function test_filter_by_city_returns_only_matching_approved_rooms(): void
    {
        $match = $this->createApprovedRoom(['city' => 'Quito']);
        $this->createApprovedRoom(['city' => 'Cuenca']);

        $response = $this->getJson('/api/storeRooms?city=Quito');

        $response->assertStatus(200);
        $ids = collect($response->json())->pluck('id')->all();
        $this->assertSame([$match->id], $ids);
    }

    public function test_filter_by_min_size_returns_only_matching_rooms(): void
    {
        $match = $this->createApprovedRoom(['size' => 50]);
        $this->createApprovedRoom(['size' => 5]);

        $response = $this->getJson('/api/storeRooms?min_size=20');

        $response->assertStatus(200);
        $ids = collect($response->json())->pluck('id')->all();
        $this->assertSame([$match->id], $ids);
    }

    public function test_filter_by_price_range_returns_only_matching_rooms(): void
    {
        $match = $this->createApprovedRoom([], 150);
        $this->createApprovedRoom([], 900);

        $response = $this->getJson('/api/storeRooms?min_price=100&max_price=200');

        $response->assertStatus(200);
        $ids = collect($response->json())->pluck('id')->all();
        $this->assertSame([$match->id], $ids);
    }

    public function test_price_filter_uses_monthly_mode_row_only(): void
    {
        $room = $this->createApprovedRoom([], 150);
        // A cheap daily rate must not make this room match a monthly range
        // it does not belong to (design decision #4 — never index [0]).
        StorePrices::factory()->create([
            'store_room_id' => $room->id,
            'mode' => 'day',
            'price' => 10,
        ]);

        $response = $this->getJson('/api/storeRooms?min_price=100&max_price=200');

        $response->assertStatus(200);
        $ids = collect($response->json())->pluck('id')->all();
        $this->assertSame([$room->id], $ids);
    }

    // -- Combined filters -------------------------------------------------

    public function test_combined_filters_return_intersection_of_matches(): void
    {
        $match = $this->createApprovedRoom(['city' => 'Manta', 'size' => 40], 300);
        $this->createApprovedRoom(['city' => 'Manta', 'size' => 5], 300);
        $this->createApprovedRoom(['city' => 'Loja', 'size' => 40], 300);

        $response = $this->getJson('/api/storeRooms?city=Manta&min_size=20&min_price=200&max_price=400');

        $response->assertStatus(200);
        $ids = collect($response->json())->pluck('id')->all();
        $this->assertSame([$match->id], $ids);
    }

    // -- Edge cases ---------------------------------------------------------

    public function test_max_price_lower_than_min_price_returns_422(): void
    {
        $response = $this->getJson('/api/storeRooms?min_price=200&max_price=100');

        $response->assertStatus(422);
    }

    public function test_filter_with_no_matches_returns_empty_array(): void
    {
        $this->createApprovedRoom(['city' => 'Quito']);

        $response = $this->getJson('/api/storeRooms?city=NoExisteEstaCiudad');

        $response->assertStatus(200);
        $response->assertExactJson([]);
    }

    public function test_room_with_null_coordinates_stays_in_results_with_null_distance(): void
    {
        $room = $this->createApprovedRoom(['latitude' => null, 'longitude' => null]);

        $response = $this->getJson('/api/storeRooms?lat=-2.170998&lng=-79.922359');

        $response->assertStatus(200);
        $ids = collect($response->json())->pluck('id')->all();
        $this->assertContains($room->id, $ids);

        $item = collect($response->json())->firstWhere('id', $room->id);
        $this->assertNull($item['distance_km']);
    }

    public function test_room_with_coordinates_returns_numeric_distance(): void
    {
        // Guayaquil coordinates, ~1km from the query point below.
        $room = $this->createApprovedRoom(['latitude' => -2.170998, 'longitude' => -79.922359]);

        $response = $this->getJson('/api/storeRooms?lat=-2.180000&lng=-79.930000');

        $response->assertStatus(200);
        $item = collect($response->json())->firstWhere('id', $room->id);
        $this->assertIsFloat($item['distance_km']);
        $this->assertGreaterThan(0, $item['distance_km']);
    }

    // -- Approved-only visibility under filters ------------------------------

    private function seedMixedStatusesInCity(int $landlordId, string $city): void
    {
        StoreRooms::factory()->create(['landlord_id' => $landlordId, 'publication_status' => 'approved', 'city' => $city]);
        StoreRooms::factory()->create(['landlord_id' => $landlordId, 'publication_status' => 'pending', 'city' => $city]);
        StoreRooms::factory()->create(['landlord_id' => $landlordId, 'publication_status' => 'rejected', 'city' => $city]);
    }

    private function statusesFrom(array $body): array
    {
        return collect($body)->pluck('publication_status')->unique()->sort()->values()->all();
    }

    public function test_anonymous_sees_only_approved_when_filters_applied(): void
    {
        $landlord = Landlords::factory()->create();
        $this->seedMixedStatusesInCity($landlord->id, 'Ambato');

        $response = $this->getJson('/api/storeRooms?city=Ambato');

        $response->assertStatus(200);
        $this->assertSame(['approved'], $this->statusesFrom($response->json()));
    }

    public function test_tenant_sees_only_approved_when_filters_applied(): void
    {
        $landlord = Landlords::factory()->create();
        $this->seedMixedStatusesInCity($landlord->id, 'Ambato');
        $tenant = User::factory()->create(['role' => 'tenant']);

        $response = $this->actingAs($tenant, 'sanctum')->getJson('/api/storeRooms?city=Ambato');

        $response->assertStatus(200);
        $this->assertSame(['approved'], $this->statusesFrom($response->json()));
    }

    public function test_owning_landlord_does_not_see_own_pending_via_filtered_catalog(): void
    {
        $landlordUser = User::factory()->create(['role' => 'landlord']);
        $landlord = Landlords::factory()->create(['user_id' => $landlordUser->id]);
        $this->seedMixedStatusesInCity($landlord->id, 'Ambato');

        $response = $this->actingAs($landlordUser, 'sanctum')->getJson('/api/storeRooms?city=Ambato');

        $response->assertStatus(200);
        $this->assertSame(['approved'], $this->statusesFrom($response->json()));
    }

    public function test_admin_sees_all_statuses_when_filters_applied(): void
    {
        $landlord = Landlords::factory()->create();
        $this->seedMixedStatusesInCity($landlord->id, 'Ambato');
        $admin = User::factory()->create(['role' => 'admin']);

        $response = $this->actingAs($admin, 'sanctum')->getJson('/api/storeRooms?city=Ambato');

        $response->assertStatus(200);
        $this->assertSame(['approved', 'pending', 'rejected'], $this->statusesFrom($response->json()));
    }
}
