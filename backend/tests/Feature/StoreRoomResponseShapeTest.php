<?php

namespace Tests\Feature;

use App\Models\Landlords;
use App\Models\Ratings;
use App\Models\StorePhoto;
use App\Models\StorePrices;
use App\Models\StoreRooms;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Characterization tests: they pin the CURRENT response shape of the three
 * public storeroom endpoints. They assert what the API does today, not what
 * it arguably should do.
 *
 * Why these exist: nothing previously guarded the shape of `landlord`,
 * `image`/`photos`, `store_prices`/`prices` or the rating fields on any of
 * these endpoints. That gap let a model-level change to `security` silently
 * turn detail()'s payload from a JSON string into an object, which crashes
 * frontend/src/Dashboard/BodegaDetalle.tsx (it JSON.parse()s that field).
 * The break was found by hand, not by the suite.
 *
 * The three endpoints deliberately diverge today — `landlord` alone has
 * three different shapes, and the same relation ships as `store_prices` on
 * two endpoints and `prices` on the third. That divergence is recorded and
 * intentionally NOT fixed here; see Engram observation #170. If a future
 * change unifies these contracts, these tests are expected to change, and
 * changing them must be a deliberate decision rather than a surprise.
 */
class StoreRoomResponseShapeTest extends TestCase
{
    use RefreshDatabase;

    /**
     * A fully populated approved storeroom: landlord with user, two photos,
     * one price, one rating. Approved so anonymous callers can see it
     * through the role filter in StoreRooms::scopeVisibleTo().
     */
    private function seedFullRoom(): array
    {
        $user = User::factory()->create([
            'name' => 'Carlos Mora',
            'email' => 'c.mora@example.test',
            'phone' => '0999999999',
        ]);
        $landlord = Landlords::factory()->create(['user_id' => $user->id]);

        $room = StoreRooms::factory()->create([
            'landlord_id' => $landlord->id,
            'publication_status' => 'approved',
            'title' => 'Galpon Via a Daule',
            'city' => 'Guayaquil',
            'direction' => 'Km 11.5 Via a Daule',
            'description' => 'Galpon con muelle de carga',
            'size' => 320,
            'room_type' => 'bodega',
            'storage_type' => 'completa',
            'security' => json_encode(['camara' => true, 'ruido' => false]),
        ]);

        StorePhoto::create(['store_room_id' => $room->id, 'photo_url' => 'photos/first.jpg']);
        StorePhoto::create(['store_room_id' => $room->id, 'photo_url' => 'photos/second.jpg']);
        StorePrices::factory()->create(['store_room_id' => $room->id, 'price' => 780]);
        Ratings::factory()->create(['store_id' => $room->id, 'stars' => 4]);

        return [$room, $landlord, $user];
    }

    // -- GET /storeRooms (index) ----------------------------------------

    public function test_index_pins_the_current_item_shape(): void
    {
        [$room, $landlord, $user] = $this->seedFullRoom();

        $response = $this->getJson('/api/storeRooms');

        $response->assertStatus(200);
        $response->assertJsonPath('0.id', $room->id);
        $response->assertJsonPath('0.title', 'Galpon Via a Daule');
        $response->assertJsonPath('0.city', 'Guayaquil');
        $response->assertJsonPath('0.publication_status', 'approved');
        $response->assertJsonPath('0.active_reservations_count', 0);

        // `landlord` is NESTED here, and carries the user's phone. detail()
        // ships a flat shape instead and getByLandlord() omits it entirely.
        $response->assertJsonPath('0.landlord.id', $landlord->id);
        $response->assertJsonPath('0.landlord.user.name', 'Carlos Mora');
        $response->assertJsonPath('0.landlord.user.email', 'c.mora@example.test');
        $response->assertJsonPath('0.landlord.user.phone', '0999999999');
        $response->assertJsonPath('0.user_id', $user->id);

        // The relation ships under `store_prices` here and under `prices`
        // on detail(). BodegasArrendador.tsx remaps this key client-side.
        $response->assertJsonPath('0.store_prices.0.price', 780);

        $response->assertJsonPath('0.rating_avg', 4);
        $response->assertJsonPath('0.rating_count', 1);

        // A single URL string, not an array: detail() serves `photos` as a
        // full array instead.
        $this->assertIsString($response->json('0.image'));
        $this->assertStringContainsString('photos/first.jpg', $response->json('0.image'));
    }

    public function test_index_does_not_expose_fields_owned_by_the_other_endpoints(): void
    {
        $this->seedFullRoom();

        $response = $this->getJson('/api/storeRooms');

        $this->assertArrayNotHasKey('direction', $response->json('0'));
        $this->assertArrayNotHasKey('description', $response->json('0'));
        $this->assertArrayNotHasKey('room_type', $response->json('0'));
        $this->assertArrayNotHasKey('storage_type', $response->json('0'));
        $this->assertArrayNotHasKey('security', $response->json('0'));
        $this->assertArrayNotHasKey('photos', $response->json('0'));
        $this->assertArrayNotHasKey('prices', $response->json('0'));
    }

    public function test_index_serves_null_image_when_the_room_has_no_photos(): void
    {
        $landlord = Landlords::factory()->create();
        StoreRooms::factory()->create([
            'landlord_id' => $landlord->id,
            'publication_status' => 'approved',
        ]);

        $response = $this->getJson('/api/storeRooms');

        $response->assertStatus(200);
        $this->assertNull($response->json('0.image'));
    }

    // -- GET /landlords/{id}/storeRooms (getByLandlord) ------------------

    public function test_get_by_landlord_pins_the_current_item_shape(): void
    {
        [$room, $landlord] = $this->seedFullRoom();

        $response = $this->getJson("/api/landlords/{$landlord->id}/storeRooms");

        $response->assertStatus(200);
        $response->assertJsonPath('0.id', $room->id);
        $response->assertJsonPath('0.title', 'Galpon Via a Daule');
        $response->assertJsonPath('0.direction', 'Km 11.5 Via a Daule');
        $response->assertJsonPath('0.city', 'Guayaquil');
        $response->assertJsonPath('0.publication_status', 'approved');
        $response->assertJsonPath('0.storage_type', 'completa');
        $response->assertJsonPath('0.room_type', 'bodega');
        $response->assertJsonPath('0.store_prices.0.price', 780);
        $response->assertJsonPath('0.active_reservations_count', 0);
        $this->assertStringContainsString('photos/first.jpg', $response->json('0.image'));
    }

    public function test_get_by_landlord_omits_landlord_and_rating_fields(): void
    {
        [, $landlord] = $this->seedFullRoom();

        $response = $this->getJson("/api/landlords/{$landlord->id}/storeRooms");

        // This endpoint ships no `landlord` block at all, which is why
        // getStoreRoomsByLandlord() in services/storeRooms.ts has no shared
        // return type with its two siblings.
        $this->assertArrayNotHasKey('landlord', $response->json('0'));
        $this->assertArrayNotHasKey('user_id', $response->json('0'));
        $this->assertArrayNotHasKey('rating_avg', $response->json('0'));
        $this->assertArrayNotHasKey('rating_count', $response->json('0'));
    }

    public function test_get_by_landlord_returns_404_when_the_landlord_has_no_visible_rooms(): void
    {
        $landlord = Landlords::factory()->create();

        $response = $this->getJson("/api/landlords/{$landlord->id}/storeRooms");

        // Pinned as current behaviour, not endorsed: an empty result is a
        // 404 here, while the admin queue deliberately serves `200 []`.
        $response->assertStatus(404);
    }

    // -- GET /store-rooms/{id}/detail (detail) ---------------------------

    public function test_detail_pins_the_current_payload_shape(): void
    {
        [$room, $landlord, $user] = $this->seedFullRoom();

        $response = $this->getJson("/api/store-rooms/{$room->id}/detail");

        $response->assertStatus(200);
        $response->assertJsonPath('id', $room->id);
        $response->assertJsonPath('title', 'Galpon Via a Daule');
        $response->assertJsonPath('description', 'Galpon con muelle de carga');
        $response->assertJsonPath('direction', 'Km 11.5 Via a Daule');
        $response->assertJsonPath('city', 'Guayaquil');
        $response->assertJsonPath('room_type', 'bodega');
        $response->assertJsonPath('storage_type', 'completa');
        $response->assertJsonPath('active_reservations_count', 0);

        // `landlord` is FLAT here, exposes user_id, and carries no phone.
        $response->assertJsonPath('landlord.id', $landlord->id);
        $response->assertJsonPath('landlord.user_id', $user->id);
        $response->assertJsonPath('landlord.name', 'Carlos Mora');
        $response->assertJsonPath('landlord.email', 'c.mora@example.test');

        // LeodegaUI.tsx:318 renders `landlord.lastname`, which this endpoint
        // has never returned. Pinned so the dead read stays visible instead
        // of being quietly "fixed" inside an unrelated change.
        $this->assertArrayNotHasKey('lastname', $response->json('landlord'));

        // `prices` here, `store_prices` on the other two endpoints.
        $response->assertJsonPath('prices.0.price', 780);

        // `photos` is a full array of URLs, unlike index()'s single `image`.
        $this->assertCount(2, $response->json('photos'));
        $this->assertStringContainsString('photos/first.jpg', $response->json('photos.0'));
    }

    public function test_detail_omits_publication_status(): void
    {
        [$room] = $this->seedFullRoom();

        $response = $this->getJson("/api/store-rooms/{$room->id}/detail");

        // Current behaviour: the other two endpoints return it, this one
        // does not. Pinned, not endorsed.
        $this->assertArrayNotHasKey('publication_status', $response->json());
        $this->assertArrayNotHasKey('image', $response->json());
        $this->assertArrayNotHasKey('rating_avg', $response->json());
    }
}
