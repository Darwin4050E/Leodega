<?php

namespace Tests\Feature;

use App\Models\Landlords;
use App\Models\StoreRooms;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

/**
 * StoreModerationQueueController: GET /store-rooms/pending and
 * GET /store-rooms/{id}/moderation-detail. Admin-only, both routes,
 * matching the existing pattern at StoreModerationTest.php:22,31 and
 * StorePermitTest.php:33,44.
 */
class StoreModerationQueueTest extends TestCase
{
    use RefreshDatabase;

    private function makeUser(string $role): User
    {
        return User::factory()->create(['role' => $role]);
    }

    // -- pending() --------------------------------------------------------

    public function test_pending_requires_authentication(): void
    {
        $response = $this->getJson('/api/store-rooms/pending');

        $response->assertStatus(401);
    }

    public function test_pending_is_forbidden_for_tenant(): void
    {
        $tenant = $this->makeUser('tenant');

        $response = $this->actingAs($tenant, 'sanctum')->getJson('/api/store-rooms/pending');

        $response->assertStatus(403);
    }

    public function test_pending_is_forbidden_for_landlord(): void
    {
        $landlord = $this->makeUser('landlord');

        $response = $this->actingAs($landlord, 'sanctum')->getJson('/api/store-rooms/pending');

        $response->assertStatus(403);
    }

    public function test_pending_returns_empty_array_never_404(): void
    {
        $admin = $this->makeUser('admin');

        $response = $this->actingAs($admin, 'sanctum')->getJson('/api/store-rooms/pending');

        $response->assertStatus(200);
        $response->assertExactJson([]);
    }

    public function test_pending_returns_only_pending_store_rooms(): void
    {
        $admin = $this->makeUser('admin');

        $pending = StoreRooms::factory()->create(['publication_status' => 'pending']);
        StoreRooms::factory()->create(['publication_status' => 'approved']);
        StoreRooms::factory()->create(['publication_status' => 'rejected']);

        $response = $this->actingAs($admin, 'sanctum')->getJson('/api/store-rooms/pending');

        $response->assertStatus(200);
        $response->assertJsonCount(1);
        $response->assertJsonPath('0.id', $pending->id);
    }

    // -- moderationDetail() ------------------------------------------------

    public function test_moderation_detail_requires_authentication(): void
    {
        $storeRoom = StoreRooms::factory()->create();

        $response = $this->getJson("/api/store-rooms/{$storeRoom->id}/moderation-detail");

        $response->assertStatus(401);
    }

    public function test_moderation_detail_is_forbidden_for_tenant(): void
    {
        $tenant = $this->makeUser('tenant');
        $storeRoom = StoreRooms::factory()->create();

        $response = $this->actingAs($tenant, 'sanctum')
            ->getJson("/api/store-rooms/{$storeRoom->id}/moderation-detail");

        $response->assertStatus(403);
    }

    public function test_moderation_detail_is_forbidden_for_landlord(): void
    {
        $landlord = $this->makeUser('landlord');
        $storeRoom = StoreRooms::factory()->create();

        $response = $this->actingAs($landlord, 'sanctum')
            ->getJson("/api/store-rooms/{$storeRoom->id}/moderation-detail");

        $response->assertStatus(403);
    }

    public function test_moderation_detail_full_payload_for_admin(): void
    {
        Storage::fake('private');

        $admin = $this->makeUser('admin');

        $landlordUser = User::factory()->create(['name' => 'Ana Torres', 'email' => 'ana@example.com']);
        $landlord = Landlords::factory()->create(['user_id' => $landlordUser->id]);

        $storeRoom = StoreRooms::factory()->create([
            'landlord_id' => $landlord->id,
            'publication_status' => 'pending',
            'direction' => 'Av. Kennedy',
            'city' => 'Guayaquil',
            'size' => 30.5,
            'description' => 'Bodega amplia y segura',
            'cancellation_policy_tier' => 'moderada',
            'security' => json_encode(['camara' => true, 'ruido' => false, 'control' => true, 'acceso' => true]),
            'latitude' => -2.118,
            'longitude' => -79.955,
            'firefighter_permit_path' => 'firefighter_permits/permit.pdf',
        ]);
        $storeRoom->storePrices()->create(['mode' => 'month', 'price' => 200, 'disponibility' => true]);
        $storeRoom->storePhotos()->create(['photo_url' => 'photos/one.jpg']);

        $response = $this->actingAs($admin, 'sanctum')
            ->getJson("/api/store-rooms/{$storeRoom->id}/moderation-detail");

        $response->assertStatus(200);
        $response->assertJsonPath('landlord.name', 'Ana Torres');
        $response->assertJsonPath('landlord.email', 'ana@example.com');
        $response->assertJsonPath('direction', 'Av. Kennedy');
        $response->assertJsonPath('city', 'Guayaquil');
        $response->assertJsonPath('latitude', -2.118);
        $response->assertJsonPath('longitude', -79.955);
        $response->assertJsonPath('size', 30.5);
        $response->assertJsonPath('monthly_price', 200);
        $response->assertJsonPath('leodega_fee', 20);
        $response->assertJsonPath('landlord_share', 180);
        $response->assertJsonPath('description', 'Bodega amplia y segura');
        $response->assertJsonPath('cancellation_policy_tier', 'moderada');
        $response->assertJsonPath('security.camara', true);
        $response->assertJsonPath('security.ruido', false);
        $response->assertJsonPath('security.control', true);
        $response->assertJsonPath('security.acceso', true);
        $response->assertJsonPath('permit_attached', true);
        $response->assertJsonCount(1, 'photos');
    }

    public function test_moderation_detail_returns_404_for_unknown_id(): void
    {
        $admin = $this->makeUser('admin');

        $response = $this->actingAs($admin, 'sanctum')->getJson('/api/store-rooms/999999/moderation-detail');

        $response->assertStatus(404);
    }

    public function test_moderation_detail_null_coordinates_are_never_invented(): void
    {
        $admin = $this->makeUser('admin');

        $storeRoom = StoreRooms::factory()->create([
            'latitude' => null,
            'longitude' => null,
        ]);

        $response = $this->actingAs($admin, 'sanctum')
            ->getJson("/api/store-rooms/{$storeRoom->id}/moderation-detail");

        $response->assertStatus(200);
        $response->assertJsonPath('latitude', null);
        $response->assertJsonPath('longitude', null);
    }

    public function test_moderation_detail_without_permit_is_false(): void
    {
        $admin = $this->makeUser('admin');

        $storeRoom = StoreRooms::factory()->create(['firefighter_permit_path' => null]);

        $response = $this->actingAs($admin, 'sanctum')
            ->getJson("/api/store-rooms/{$storeRoom->id}/moderation-detail");

        $response->assertStatus(200);
        $response->assertJsonPath('permit_attached', false);
    }
}
