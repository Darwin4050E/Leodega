<?php

namespace Tests\Feature;

use App\Models\StoreRooms;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class StoreRoomModerationTest extends TestCase
{
    use RefreshDatabase;

    /** @test */
    public function admin_can_approve_a_store_room()
    {
        // Admin
        $admin = User::factory()->create([
            'role' => 'admin',
        ]);

        Sanctum::actingAs($admin);

        // Store room en estado pending
        $storeRoom = StoreRooms::factory()->create([
            'publication_status' => 'pending',
        ]);

        // Act: aprobar bodega
        $response = $this->putJson("/api/storeRooms/{$storeRoom->id}", [
            'publication_status' => 'approved',
        ]);

        // Assert
        $response->assertStatus(200);

        $this->assertDatabaseHas('storeRooms', [
            'id' => $storeRoom->id,
            'publication_status' => 'approved',
        ]);
    }

    /**
     * Corrección de inconsistencia (ver PLAN_CORRECCION_INCONSISTENCIAS.md,
     * Fase 2.1): antes, aprobar/rechazar vía este mismo endpoint no dejaba
     * registro en store_moderation ni notificaba al landlord.
     */
    public function test_approving_creates_moderation_record_and_notifies_landlord()
    {
        $admin = User::factory()->create(['role' => 'admin']);
        Sanctum::actingAs($admin);

        $storeRoom = StoreRooms::factory()->create(['publication_status' => 'pending']);
        $storeRoom->load('landlord.user');

        $response = $this->putJson("/api/storeRooms/{$storeRoom->id}", [
            'publication_status' => 'approved',
        ]);

        $response->assertStatus(200);

        $this->assertDatabaseHas('store_moderation', [
            'store_id' => $storeRoom->id,
            'status' => 'approved',
        ]);

        $this->assertDatabaseHas('notifications', [
            'sender_id' => $admin->id,
            'receiver_id' => $storeRoom->landlord->user->id,
            'type' => 'store_approved',
        ]);
    }

    public function test_rejecting_requires_a_reason()
    {
        $admin = User::factory()->create(['role' => 'admin']);
        Sanctum::actingAs($admin);

        $storeRoom = StoreRooms::factory()->create(['publication_status' => 'pending']);

        $response = $this->putJson("/api/storeRooms/{$storeRoom->id}", [
            'publication_status' => 'rejected',
        ]);

        $response->assertStatus(422);

        $this->assertDatabaseHas('storeRooms', [
            'id' => $storeRoom->id,
            'publication_status' => 'pending',
        ]);
    }

    public function test_rejecting_with_reason_creates_moderation_record()
    {
        $admin = User::factory()->create(['role' => 'admin']);
        Sanctum::actingAs($admin);

        $storeRoom = StoreRooms::factory()->create(['publication_status' => 'pending']);

        $response = $this->putJson("/api/storeRooms/{$storeRoom->id}", [
            'publication_status' => 'rejected',
            'reason_rejected' => 'Permiso de bomberos vencido',
        ]);

        $response->assertStatus(200);

        $this->assertDatabaseHas('storeRooms', [
            'id' => $storeRoom->id,
            'publication_status' => 'rejected',
        ]);

        $this->assertDatabaseHas('store_moderation', [
            'store_id' => $storeRoom->id,
            'status' => 'rejected',
            'reason_rejected' => 'Permiso de bomberos vencido',
        ]);
    }

    /**
     * Antes de esta corrección, cualquier usuario autenticado (incluido el
     * propio landlord) podía auto-aprobarse la bodega vía este endpoint.
     */
    public function test_non_admin_cannot_approve_or_reject_a_store_room()
    {
        $landlordUser = User::factory()->create(['role' => 'landlord']);
        Sanctum::actingAs($landlordUser);

        $storeRoom = StoreRooms::factory()->create(['publication_status' => 'pending']);

        $response = $this->putJson("/api/storeRooms/{$storeRoom->id}", [
            'publication_status' => 'approved',
        ]);

        $response->assertStatus(403);

        $this->assertDatabaseHas('storeRooms', [
            'id' => $storeRoom->id,
            'publication_status' => 'pending',
        ]);
        $this->assertDatabaseCount('store_moderation', 0);
    }

    /**
     * El check de admin solo debe aplicar cuando el payload intenta CAMBIAR
     * publication_status a approved/rejected. Editar otros campos de la
     * propia bodega (flujo normal del landlord) debe seguir funcionando.
     */
    public function test_landlord_can_still_edit_other_fields_of_own_store_room()
    {
        $landlordUser = User::factory()->create(['role' => 'landlord']);
        Sanctum::actingAs($landlordUser);

        $storeRoom = StoreRooms::factory()->create(['publication_status' => 'pending']);

        $response = $this->putJson("/api/storeRooms/{$storeRoom->id}", [
            'title' => 'Nuevo título de la bodega',
        ]);

        $response->assertStatus(200);

        $this->assertDatabaseHas('storeRooms', [
            'id' => $storeRoom->id,
            'title' => 'Nuevo título de la bodega',
        ]);
    }

    /** @test */
    public function public_store_rooms_endpoint_returns_store_rooms_with_different_publication_statuses()
    {
        // Crear bodegas con distintos estados
        StoreRooms::factory()->create([
            'publication_status' => 'approved',
        ]);

        StoreRooms::factory()->create([
            'publication_status' => 'pending',
        ]);

        StoreRooms::factory()->create([
            'publication_status' => 'rejected',
        ]);

        // Act
        $response = $this->getJson('/api/storeRooms');

        // Assert
        $response->assertStatus(200);

        $response->assertJsonFragment([
            'publication_status' => 'approved',
        ]);

        $response->assertJsonFragment([
            'publication_status' => 'pending',
        ]);
    }
}
