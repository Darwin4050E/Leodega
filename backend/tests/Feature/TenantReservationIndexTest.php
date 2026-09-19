<?php

namespace Tests\Feature;

use App\Models\Reservations;
use App\Models\StorePhoto;
use App\Models\StoreRooms;
use App\Models\Tenants;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * sdd/tenant-reservations-screen: tenantIndex() gains two server-computed
 * fields mirroring landlordIndex()'s established idiom -- can_be_cancelled
 * (Reservations::isCancellableByTenant()) and photo_url (a directly-usable
 * asset() URL, not the bare storage-relative path).
 */
class TenantReservationIndexTest extends TestCase
{
    use RefreshDatabase;

    private function tenant(): array
    {
        $user = User::factory()->create();
        $tenant = Tenants::factory()->create(['user_id' => $user->id]);

        return [$user, $tenant];
    }

    public function test_can_be_cancelled_is_true_for_an_eligible_reservation()
    {
        [$user, $tenant] = $this->tenant();
        $room = StoreRooms::factory()->create();

        $reservation = Reservations::factory()->create([
            'store_room_id' => $room->id,
            'tenant_id' => $tenant->id,
            'status' => 'confirmed',
            'start_date' => today()->addDays(5)->toDateString(),
            'end_date' => today()->addDays(35)->toDateString(),
        ]);

        $response = $this->actingAs($user, 'sanctum')->getJson('/api/tenant/reservations');

        $item = collect($response->json())->firstWhere('id', $reservation->id);
        $this->assertTrue($item['can_be_cancelled']);
    }

    public function test_can_be_cancelled_is_false_once_the_reservation_started()
    {
        [$user, $tenant] = $this->tenant();
        $room = StoreRooms::factory()->create();

        $reservation = Reservations::factory()->create([
            'store_room_id' => $room->id,
            'tenant_id' => $tenant->id,
            'status' => 'confirmed',
            'start_date' => today()->toDateString(),
            'end_date' => today()->addDays(30)->toDateString(),
        ]);

        $response = $this->actingAs($user, 'sanctum')->getJson('/api/tenant/reservations');

        $item = collect($response->json())->firstWhere('id', $reservation->id);
        $this->assertFalse($item['can_be_cancelled']);
    }

    /**
     * Uses App\Models\StoreRooms::storePhotos() (verified StoreRooms.php:49),
     * NOT a non-existent photos() relation, and applies the same
     * asset('storage/'.$p->photo_url) transform as
     * StoreRoomDetailResource::toArray() (StoreRoomDetailResource.php:53) --
     * a bare relation exposure would ship an unusable storage-relative path.
     */
    public function test_photo_url_is_a_directly_usable_asset_url()
    {
        [$user, $tenant] = $this->tenant();
        $room = StoreRooms::factory()->create();
        StorePhoto::create([
            'store_room_id' => $room->id,
            'photo_url' => 'store_photos/example.jpg',
        ]);

        $reservation = Reservations::factory()->create([
            'store_room_id' => $room->id,
            'tenant_id' => $tenant->id,
            'status' => 'confirmed',
            'start_date' => today()->addDays(5)->toDateString(),
            'end_date' => today()->addDays(35)->toDateString(),
        ]);

        $response = $this->actingAs($user, 'sanctum')->getJson('/api/tenant/reservations');

        $item = collect($response->json())->firstWhere('id', $reservation->id);
        $this->assertSame(asset('storage/store_photos/example.jpg'), $item['photo_url']);
    }

    public function test_photo_url_is_null_when_the_storeroom_has_no_photo()
    {
        [$user, $tenant] = $this->tenant();
        $room = StoreRooms::factory()->create();

        $reservation = Reservations::factory()->create([
            'store_room_id' => $room->id,
            'tenant_id' => $tenant->id,
            'status' => 'confirmed',
            'start_date' => today()->addDays(5)->toDateString(),
            'end_date' => today()->addDays(35)->toDateString(),
        ]);

        $response = $this->actingAs($user, 'sanctum')->getJson('/api/tenant/reservations');

        $item = collect($response->json())->firstWhere('id', $reservation->id);
        $this->assertNull($item['photo_url']);
    }
}
