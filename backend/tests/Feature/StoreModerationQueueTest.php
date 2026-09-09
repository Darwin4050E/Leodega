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

        Storage::fake('private');

        $landlordUser = User::factory()->create(['name' => 'Ana Torres', 'email' => 'ana@example.com']);
        $landlord = Landlords::factory()->create(['user_id' => $landlordUser->id]);

        $pending = StoreRooms::factory()->create([
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
            'room_type' => 'bodega',
            'storage_type' => 'privado',
        ]);
        $pending->storePrices()->create(['mode' => 'month', 'price' => 200, 'disponibility' => true]);
        $pending->storePhotos()->create(['photo_url' => 'photos/one.jpg']);

        StoreRooms::factory()->create(['publication_status' => 'approved']);
        StoreRooms::factory()->create(['publication_status' => 'rejected']);

        $response = $this->actingAs($admin, 'sanctum')->getJson('/api/store-rooms/pending');

        $response->assertStatus(200);
        $response->assertJsonCount(1);
        $response->assertJsonPath('0.id', $pending->id);
        $response->assertJsonPath('0.landlord.name', 'Ana Torres');
        $response->assertJsonPath('0.landlord.email', 'ana@example.com');
        $response->assertJsonPath('0.direction', 'Av. Kennedy');
        $response->assertJsonPath('0.city', 'Guayaquil');
        $response->assertJsonPath('0.latitude', -2.118);
        $response->assertJsonPath('0.longitude', -79.955);
        $response->assertJsonPath('0.size', 30.5);
        $response->assertJsonPath('0.monthly_price', 200);
        $response->assertJsonPath('0.leodega_fee', 20);
        $response->assertJsonPath('0.landlord_share', 180);
        $response->assertJsonPath('0.description', 'Bodega amplia y segura');
        $response->assertJsonPath('0.cancellation_policy_tier', 'moderada');
        $response->assertJsonPath('0.security.camara', true);
        $response->assertJsonPath('0.security.ruido', false);
        $response->assertJsonPath('0.security.control', true);
        $response->assertJsonPath('0.security.acceso', true);
        $response->assertJsonPath('0.permit_attached', true);
        $response->assertJsonPath('0.permit_filename', 'permit.pdf');
        $response->assertJsonCount(1, '0.photos');
        $response->assertJsonPath('0.room_type', 'bodega');
        $response->assertJsonPath('0.storage_type', 'privado');
    }

    public function test_pending_history_orders_newest_first_via_shared_eager_load(): void
    {
        $admin = $this->makeUser('admin');
        $storeRoom = StoreRooms::factory()->create(['publication_status' => 'pending']);

        $storeRoom->moderations()->create([
            'status' => 'rejected',
            'reason_code' => 'fotos',
            'reason_rejected' => 'Fotos borrosas',
            'admin_id' => $admin->id,
            'moderation_date' => now()->subDays(2),
        ]);
        $storeRoom->moderations()->create([
            'status' => 'rejected',
            'reason_code' => 'info',
            'reason_rejected' => 'Descripción incompleta',
            'admin_id' => $admin->id,
            'moderation_date' => now()->subDay(),
        ]);

        $response = $this->actingAs($admin, 'sanctum')->getJson('/api/store-rooms/pending');

        $response->assertStatus(200);
        $response->assertJsonPath('0.moderation_history.0.reason_code', 'info');
        $response->assertJsonPath('0.moderation_history.0.reason_rejected', 'Descripción incompleta');
        $response->assertJsonPath('0.moderation_history.0.admin_id', $admin->id);
        $response->assertJsonPath('0.moderation_history.1.reason_code', 'fotos');
    }

    public function test_pending_permit_filename_present_when_attached(): void
    {
        $admin = $this->makeUser('admin');

        $storeRoom = StoreRooms::factory()->create([
            'publication_status' => 'pending',
            'firefighter_permit_path' => 'firefighter_permits/permiso_bomberos_daule.pdf',
        ]);

        $response = $this->actingAs($admin, 'sanctum')->getJson('/api/store-rooms/pending');

        $response->assertStatus(200);
        $response->assertJsonPath('0.permit_filename', 'permiso_bomberos_daule.pdf');
    }

    public function test_pending_permit_filename_null_when_absent(): void
    {
        $admin = $this->makeUser('admin');

        StoreRooms::factory()->create([
            'publication_status' => 'pending',
            'firefighter_permit_path' => null,
        ]);

        $response = $this->actingAs($admin, 'sanctum')->getJson('/api/store-rooms/pending');

        $response->assertStatus(200);
        $response->assertJsonPath('0.permit_filename', null);
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
            'room_type' => 'bodega',
            'storage_type' => 'privado',
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
        $response->assertJsonPath('permit_filename', 'permit.pdf');
        $response->assertJsonCount(1, 'photos');
        $response->assertJsonPath('room_type', 'bodega');
        $response->assertJsonPath('storage_type', 'privado');
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

    // -- moderation_history (additive, SDD 2) ------------------------------

    public function test_moderation_detail_history_is_empty_for_a_room_with_no_prior_decisions(): void
    {
        $admin = $this->makeUser('admin');
        $storeRoom = StoreRooms::factory()->create();

        $response = $this->actingAs($admin, 'sanctum')
            ->getJson("/api/store-rooms/{$storeRoom->id}/moderation-detail");

        $response->assertStatus(200);
        $response->assertJsonPath('moderation_history', []);
    }

    public function test_moderation_detail_shows_prior_rejection_newest_first(): void
    {
        $admin = $this->makeUser('admin');
        $storeRoom = StoreRooms::factory()->create();

        $storeRoom->moderations()->create([
            'status' => 'rejected',
            'reason_code' => 'fotos',
            'reason_rejected' => 'Fotos borrosas',
            'admin_id' => $admin->id,
            'moderation_date' => now()->subDays(2),
        ]);
        $storeRoom->moderations()->create([
            'status' => 'rejected',
            'reason_code' => 'info',
            'reason_rejected' => 'Descripción incompleta',
            'admin_id' => $admin->id,
            'moderation_date' => now()->subDay(),
        ]);

        $response = $this->actingAs($admin, 'sanctum')
            ->getJson("/api/store-rooms/{$storeRoom->id}/moderation-detail");

        $response->assertStatus(200);
        $response->assertJsonPath('moderation_history.0.reason_code', 'info');
        $response->assertJsonPath('moderation_history.0.reason_rejected', 'Descripción incompleta');
        $response->assertJsonPath('moderation_history.0.admin_id', $admin->id);
        $response->assertJsonPath('moderation_history.1.reason_code', 'fotos');
    }
}
