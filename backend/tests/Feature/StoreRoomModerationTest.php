<?php

namespace Tests\Feature;

use App\Models\Landlords;
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

        // Store room en estado pending, con permiso adjunto (no requiere waiver).
        $storeRoom = StoreRooms::factory()->create([
            'publication_status' => 'pending',
            'firefighter_permit_path' => 'firefighter_permits/permit.pdf',
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

        $storeRoom = StoreRooms::factory()->create([
            'publication_status' => 'pending',
            'firefighter_permit_path' => 'firefighter_permits/permit.pdf',
        ]);
        $storeRoom->load('landlord.user');

        $response = $this->putJson("/api/storeRooms/{$storeRoom->id}", [
            'publication_status' => 'approved',
        ]);

        $response->assertStatus(200);

        $this->assertDatabaseHas('store_moderation', [
            'store_id' => $storeRoom->id,
            'status' => 'approved',
            'admin_id' => $admin->id,
            'permit_waived_at' => null,
        ]);

        $this->assertDatabaseHas('notifications', [
            'sender_id' => $admin->id,
            'receiver_id' => $storeRoom->landlord->user->id,
            'type' => 'store_approved',
        ]);
    }

    /**
     * SDD 2: approving a permit-less room requires an explicit
     * `permit_waiver_acknowledged` flag; without it the request is 422.
     */
    public function test_approving_a_permitless_room_without_waiver_acknowledgment_fails()
    {
        $admin = User::factory()->create(['role' => 'admin']);
        Sanctum::actingAs($admin);

        $storeRoom = StoreRooms::factory()->create([
            'publication_status' => 'pending',
            'firefighter_permit_path' => null,
        ]);

        $response = $this->putJson("/api/storeRooms/{$storeRoom->id}", [
            'publication_status' => 'approved',
        ]);

        $response->assertStatus(422);

        $this->assertDatabaseHas('storeRooms', [
            'id' => $storeRoom->id,
            'publication_status' => 'pending',
        ]);
    }

    public function test_approving_a_permitless_room_with_waiver_acknowledgment_records_the_timestamp()
    {
        $admin = User::factory()->create(['role' => 'admin']);
        Sanctum::actingAs($admin);

        $storeRoom = StoreRooms::factory()->create([
            'publication_status' => 'pending',
            'firefighter_permit_path' => null,
        ]);

        $response = $this->putJson("/api/storeRooms/{$storeRoom->id}", [
            'publication_status' => 'approved',
            'permit_waiver_acknowledged' => true,
        ]);

        $response->assertStatus(200);

        $moderation = $storeRoom->fresh()->moderations()->latest('id')->first();
        $this->assertNotNull($moderation->permit_waived_at);
    }

    public function test_approving_a_room_with_a_permit_ignores_the_waiver_flag()
    {
        $admin = User::factory()->create(['role' => 'admin']);
        Sanctum::actingAs($admin);

        $storeRoom = StoreRooms::factory()->create([
            'publication_status' => 'pending',
            'firefighter_permit_path' => 'firefighter_permits/permit.pdf',
        ]);

        $response = $this->putJson("/api/storeRooms/{$storeRoom->id}", [
            'publication_status' => 'approved',
        ]);

        $response->assertStatus(200);

        $moderation = $storeRoom->fresh()->moderations()->latest('id')->first();
        $this->assertNull($moderation->permit_waived_at);
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
        $response->assertJsonValidationErrors('reason_code');

        $this->assertDatabaseHas('storeRooms', [
            'id' => $storeRoom->id,
            'publication_status' => 'pending',
        ]);
    }

    public function test_rejecting_with_reason_code_otro_requires_a_comment()
    {
        $admin = User::factory()->create(['role' => 'admin']);
        Sanctum::actingAs($admin);

        $storeRoom = StoreRooms::factory()->create(['publication_status' => 'pending']);

        $response = $this->putJson("/api/storeRooms/{$storeRoom->id}", [
            'publication_status' => 'rejected',
            'reason_code' => 'otro',
        ]);

        $response->assertStatus(422);
        $response->assertJsonValidationErrors('reason_rejected');
    }

    public function test_rejecting_with_reason_creates_moderation_record()
    {
        $admin = User::factory()->create(['role' => 'admin']);
        Sanctum::actingAs($admin);

        $storeRoom = StoreRooms::factory()->create(['publication_status' => 'pending']);

        $response = $this->putJson("/api/storeRooms/{$storeRoom->id}", [
            'publication_status' => 'rejected',
            'reason_code' => 'permiso',
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
            'reason_code' => 'permiso',
            'reason_rejected' => 'Permiso de bomberos vencido',
            'admin_id' => $admin->id,
        ]);
    }

    /**
     * `reason_code` other than `otro` accepts an empty comment (spec #175).
     */
    public function test_rejecting_with_a_non_otro_reason_accepts_an_empty_comment()
    {
        $admin = User::factory()->create(['role' => 'admin']);
        Sanctum::actingAs($admin);

        $storeRoom = StoreRooms::factory()->create(['publication_status' => 'pending']);

        $response = $this->putJson("/api/storeRooms/{$storeRoom->id}", [
            'publication_status' => 'rejected',
            'reason_code' => 'fotos',
        ]);

        $response->assertStatus(200);

        $this->assertDatabaseHas('store_moderation', [
            'store_id' => $storeRoom->id,
            'status' => 'rejected',
            'reason_code' => 'fotos',
        ]);
    }

    /**
     * Drift-detection guard (mandatory, SDD 2 task A15): both moderation
     * entry points MUST consume the exact same shared rules bag
     * (ModerationDecisionRules). This test submits the identical
     * reject-with-`reason_code=otro`-and-no-comment payload to BOTH
     * `PUT /storeRooms/{id}` and `POST /store_moderation`, and asserts both
     * fail 422 on `reason_rejected`. If a future change reverts either
     * entry point to an inline/duplicated rule set, THIS is the test that
     * catches the drift — do not simplify it away.
     */
    public function test_drift_guard_both_entry_points_reject_the_same_invalid_otro_payload_identically()
    {
        $admin = User::factory()->create(['role' => 'admin']);
        Sanctum::actingAs($admin);

        $storeRoomForPut = StoreRooms::factory()->create(['publication_status' => 'pending']);
        $storeRoomForPost = StoreRooms::factory()->create(['publication_status' => 'pending']);

        $putResponse = $this->putJson("/api/storeRooms/{$storeRoomForPut->id}", [
            'publication_status' => 'rejected',
            'reason_code' => 'otro',
        ]);

        $postResponse = $this->postJson('/api/store_moderation', [
            'store_id' => $storeRoomForPost->id,
            'status' => 'rejected',
            'reason_code' => 'otro',
        ]);

        $putResponse->assertStatus(422);
        $putResponse->assertJsonValidationErrors('reason_rejected');

        $postResponse->assertStatus(422);
        $postResponse->assertJsonValidationErrors('reason_rejected');
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
     * propia bodega (flujo normal del landlord — HUG-08) debe seguir
     * funcionando; la cobertura completa de ese camino vive en
     * StoreRoomUpdateTest.
     */
    public function test_landlord_can_still_edit_other_fields_of_own_store_room()
    {
        $landlordUser = User::factory()->create(['role' => 'landlord']);
        $landlord = Landlords::factory()->create(['user_id' => $landlordUser->id]);
        Sanctum::actingAs($landlordUser);

        $storeRoom = StoreRooms::factory()->create([
            'landlord_id' => $landlord->id,
            'publication_status' => 'pending',
        ]);

        $response = $this->putJson("/api/storeRooms/{$storeRoom->id}", [
            'title' => 'Nuevo título de la bodega',
        ]);

        $response->assertStatus(200);

        $this->assertDatabaseHas('storeRooms', [
            'id' => $storeRoom->id,
            'title' => 'Nuevo título de la bodega',
        ]);
    }

    /**
     * REMOVED requirement "Public Listing Returns All Statuses To Any
     * Caller" (spec #162): this test used to lock in a data leak — an
     * anonymous caller received `pending` and `rejected` storerooms. It is
     * rewritten to assert the corrected, role-filtered behaviour: an
     * anonymous caller only ever sees `approved` storerooms. The full role
     * matrix (tenant, owning landlord, admin, non-owning landlord) lives in
     * StoreRoomVisibilityTest.
     */
    /** @test */
    public function public_store_rooms_endpoint_returns_only_approved_store_rooms_for_anonymous_callers()
    {
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

        $statuses = collect($response->json())->pluck('publication_status')->unique()->values()->all();

        $this->assertSame(['approved'], $statuses);
    }
}
