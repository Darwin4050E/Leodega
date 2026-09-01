<?php

namespace Tests\Feature;

use App\Models\StoreModeration;
use App\Models\StoreRooms;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class StoreModerationTest extends TestCase
{
    use RefreshDatabase;

    // Fase 0.5: /api/store_moderation no tenía ninguna protección — cola de
    // moderación interna expuesta sin autenticación. Ahora requiere sesión +
    // role:admin.
    public function test_index_requires_authentication()
    {
        $response = $this->getJson('/api/store_moderation');

        $response->assertStatus(401);
    }

    public function test_index_requires_admin_role()
    {
        $landlord = User::factory()->create(['role' => 'landlord']);

        $response = $this->actingAs($landlord, 'sanctum')->getJson('/api/store_moderation');

        $response->assertStatus(403);
    }

    public function test_index_returns_records_for_admin_role()
    {
        $admin = User::factory()->create(['role' => 'admin']);
        $storeRoom = StoreRooms::factory()->create();
        StoreModeration::create([
            'store_id' => $storeRoom->id,
            'status' => 'pending',
            'reason_rejected' => '',
        ]);

        $response = $this->actingAs($admin, 'sanctum')->getJson('/api/store_moderation');

        $response->assertStatus(200);
        $response->assertJsonCount(1);
    }

    public function test_store_requires_admin_role()
    {
        $tenant = User::factory()->create(['role' => 'tenant']);
        $storeRoom = StoreRooms::factory()->create();

        $response = $this->actingAs($tenant, 'sanctum')->postJson('/api/store_moderation', [
            'store_id' => $storeRoom->id,
            'status' => 'approved',
            'reason_rejected' => '',
        ]);

        $response->assertStatus(403);
    }

    public function test_store_creates_moderation_record_as_admin()
    {
        $admin = User::factory()->create(['role' => 'admin']);
        $storeRoom = StoreRooms::factory()->create();

        $response = $this->actingAs($admin, 'sanctum')->postJson('/api/store_moderation', [
            'store_id' => $storeRoom->id,
            'status' => 'approved',
            'reason_rejected' => 'N/A',
        ]);

        $response->assertStatus(201);
        $this->assertDatabaseHas('store_moderation', ['store_id' => $storeRoom->id, 'status' => 'approved']);
    }
}
