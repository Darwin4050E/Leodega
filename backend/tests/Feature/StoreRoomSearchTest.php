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

    // -- City matching: case-insensitive, trimmed, exact --------------------

    private function idsFor(string $url): array
    {
        $response = $this->getJson($url);
        $response->assertStatus(200);

        return collect($response->json())->pluck('id')->all();
    }

    public function test_city_filter_ignores_case_of_the_input(): void
    {
        $quito = $this->createApprovedRoom(['city' => 'Quito']);
        $this->createApprovedRoom(['city' => 'Guayaquil']);

        $this->assertSame([$quito->id], $this->idsFor('/api/storeRooms?city=quito'));
        $this->assertSame([$quito->id], $this->idsFor('/api/storeRooms?city=QUITO'));
    }

    public function test_city_filter_ignores_whitespace_around_the_stored_city(): void
    {
        $padded = $this->createApprovedRoom(['city' => '  Quito  ']);
        $trailing = $this->createApprovedRoom(['city' => 'quito ']);
        $this->createApprovedRoom(['city' => 'Guayaquil']);

        $ids = $this->idsFor('/api/storeRooms?city=Quito');

        $this->assertEqualsCanonicalizing([$padded->id, $trailing->id], $ids);
    }

    public function test_city_filter_ignores_whitespace_around_the_input(): void
    {
        $quito = $this->createApprovedRoom(['city' => 'Quito']);
        $this->createApprovedRoom(['city' => 'Cuenca']);

        $this->assertSame([$quito->id], $this->idsFor('/api/storeRooms?city=%20Quito%20'));
        $this->assertSame([$quito->id], $this->idsFor('/api/storeRooms?city=Quito'));
    }

    public function test_city_filter_does_not_fold_accents(): void
    {
        $cuenca = $this->createApprovedRoom(['city' => 'Cuenca']);

        $this->assertSame([], $this->idsFor('/api/storeRooms?city=Cu%C3%A9nca'));
        $this->assertSame([$cuenca->id], $this->idsFor('/api/storeRooms?city=Cuenca'));
    }

    public function test_city_filter_is_an_exact_match_not_a_partial_one(): void
    {
        $quito = $this->createApprovedRoom(['city' => 'Quito']);
        $this->createApprovedRoom(['city' => 'Quito, Ecuador']);

        $this->assertSame([], $this->idsFor('/api/storeRooms?city=Quit'));
        $this->assertSame([$quito->id], $this->idsFor('/api/storeRooms?city=Quito'));
    }

    public function test_empty_or_whitespace_only_city_is_rejected_with_422(): void
    {
        $this->createApprovedRoom(['city' => 'Quito']);

        $this->getJson('/api/storeRooms?city=')->assertStatus(422);
        $this->getJson('/api/storeRooms?city=%20')->assertStatus(422);
    }

    public function test_city_without_rooms_returns_200_and_an_empty_array(): void
    {
        $this->createApprovedRoom(['city' => 'Quito']);

        $response = $this->getJson('/api/storeRooms?city=Loja');

        $response->assertStatus(200);
        $response->assertExactJson([]);
    }

    public function test_city_filter_composes_with_min_size(): void
    {
        $large = $this->createApprovedRoom(['city' => 'Quito', 'size' => 20]);
        $this->createApprovedRoom(['city' => 'Quito', 'size' => 8]);
        $this->createApprovedRoom(['city' => 'Guayaquil', 'size' => 30]);

        $this->assertSame([$large->id], $this->idsFor('/api/storeRooms?city=quito&min_size=10'));
    }

    public function test_city_filter_composes_with_price_range(): void
    {
        $match = $this->createApprovedRoom(['city' => 'Guayaquil'], 80);
        $this->createApprovedRoom(['city' => 'Guayaquil'], 40);
        $this->createApprovedRoom(['city' => 'Quito'], 80);

        $ids = $this->idsFor('/api/storeRooms?city=guayaquil&min_price=50&max_price=100');

        $this->assertSame([$match->id], $ids);
    }

    public function test_city_filter_keeps_distance_driven_only_by_coordinates(): void
    {
        $withCoords = $this->createApprovedRoom(['city' => 'Quito', 'latitude' => -0.2, 'longitude' => -78.5]);
        $withoutCoords = $this->createApprovedRoom(['city' => 'Quito', 'latitude' => null, 'longitude' => null]);

        $response = $this->getJson('/api/storeRooms?city=quito&lat=-0.18&lng=-78.48');

        $response->assertStatus(200);
        $this->assertIsFloat(collect($response->json())->firstWhere('id', $withCoords->id)['distance_km']);
        $this->assertNull(collect($response->json())->firstWhere('id', $withoutCoords->id)['distance_km']);
    }

    public function test_city_filter_without_coordinates_returns_null_distance_everywhere(): void
    {
        $this->createApprovedRoom(['city' => 'Quito', 'latitude' => -0.2, 'longitude' => -78.5]);
        $this->createApprovedRoom(['city' => 'Quito', 'latitude' => -0.3, 'longitude' => -78.6]);

        $response = $this->getJson('/api/storeRooms?city=quito');

        $response->assertStatus(200);
        $distances = collect($response->json())->pluck('distance_km')->all();
        $this->assertSame([null, null], $distances);
    }

    public function test_case_insensitive_city_match_does_not_expose_pending_rooms_to_anonymous(): void
    {
        $landlord = Landlords::factory()->create();
        $this->seedMixedStatusesInCity($landlord->id, 'Quito');

        $response = $this->getJson('/api/storeRooms?city=quito');

        $response->assertStatus(200);
        $this->assertCount(1, $response->json());
        $this->assertSame(['approved'], $this->statusesFrom($response->json()));
    }

    public function test_city_filter_treats_sql_metacharacters_as_data(): void
    {
        $this->createApprovedRoom(['city' => 'Quito']);

        $response = $this->getJson('/api/storeRooms?city='.rawurlencode("' OR 1=1 --"));

        $response->assertStatus(200);
        $response->assertExactJson([]);
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
