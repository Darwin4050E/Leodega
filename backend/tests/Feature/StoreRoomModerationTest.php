<?php

namespace Tests\Feature;

use App\Models\Landlords;
use App\Models\Reservations;
use App\Models\StoreDisponibility;
use App\Models\StoreModeration;
use App\Models\StorePrices;
use App\Models\StoreRooms;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use PHPUnit\Framework\Attributes\DataProvider;
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
        $storeRoom = StoreRooms::factory()->withPhotos()->create([
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

        $storeRoom = StoreRooms::factory()->withPhotos()->create([
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

        $storeRoom = StoreRooms::factory()->withPhotos()->create([
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

        $storeRoom = StoreRooms::factory()->withPhotos()->create([
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

        $storeRoom = StoreRooms::factory()->withPhotos()->create([
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

    public function test_approving_a_room_with_fewer_than_three_photos_fails_through_both_entry_points()
    {
        $admin = User::factory()->create(['role' => 'admin']);
        Sanctum::actingAs($admin);

        $roomForPut = StoreRooms::factory()->withPhotos(2)->create([
            'publication_status' => 'pending',
            'firefighter_permit_path' => 'firefighter_permits/permit.pdf',
        ]);
        $roomForPost = StoreRooms::factory()->withPhotos(2)->create([
            'publication_status' => 'pending',
            'firefighter_permit_path' => 'firefighter_permits/permit.pdf',
        ]);

        $putResponse = $this->putJson("/api/storeRooms/{$roomForPut->id}", [
            'publication_status' => 'approved',
        ]);
        $postResponse = $this->postJson('/api/store_moderation', [
            'store_id' => $roomForPost->id,
            'status' => 'approved',
        ]);

        foreach ([$putResponse, $postResponse] as $response) {
            $response->assertStatus(422);
            $response->assertJsonValidationErrors('photos');
            $response->assertJsonPath('message', 'La bodega necesita al menos 3 fotos para ser aprobada.');
        }

        foreach ([$roomForPut, $roomForPost] as $room) {
            $this->assertDatabaseHas('storeRooms', ['id' => $room->id, 'publication_status' => 'pending']);
        }
        $this->assertDatabaseCount('store_moderation', 0);
        $this->assertDatabaseCount('notifications', 0);
    }

    public function test_rejecting_a_room_without_photos_is_still_allowed()
    {
        $admin = User::factory()->create(['role' => 'admin']);
        Sanctum::actingAs($admin);

        $storeRoom = StoreRooms::factory()->create(['publication_status' => 'pending']);

        $this->putJson("/api/storeRooms/{$storeRoom->id}", [
            'publication_status' => 'rejected',
            'reason_code' => 'fotos',
        ])->assertStatus(200);

        $this->assertDatabaseHas('storeRooms', ['id' => $storeRoom->id, 'publication_status' => 'rejected']);
    }

    /**
     * Admin PUT is moderation-only: the decision is read from the request BODY
     * and a `publication_status` that only travels in the query string must
     * never turn a non-decision payload into an approval.
     */
    public function test_a_query_string_publication_status_does_not_turn_a_non_decision_admin_body_into_an_approval()
    {
        $admin = User::factory()->create(['role' => 'admin']);
        Sanctum::actingAs($admin);

        $storeRoom = StoreRooms::factory()->withPhotos()->create([
            'publication_status' => 'pending',
            'firefighter_permit_path' => 'firefighter_permits/permit.pdf',
        ]);

        $response = $this->putJson("/api/storeRooms/{$storeRoom->id}?publication_status=approved", [
            'title' => 'X',
        ]);

        $response->assertStatus(422);
        $response->assertJsonValidationErrors('publication_status');
        $this->assertDatabaseHas('storeRooms', ['id' => $storeRoom->id, 'publication_status' => 'pending']);
        $this->assertDatabaseCount('store_moderation', 0);
    }

    /**
     * Characterization (AMO-1): an admin approval keeps the response shape the
     * admin panel relies on, and writes exactly one record and one notification.
     */
    public function test_admin_approval_returns_data_message_status_and_writes_one_record_and_one_notification()
    {
        $admin = User::factory()->create(['role' => 'admin']);
        Sanctum::actingAs($admin);

        $storeRoom = StoreRooms::factory()->withPhotos()->create([
            'publication_status' => 'pending',
            'firefighter_permit_path' => 'firefighter_permits/permit.pdf',
        ]);

        $response = $this->putJson("/api/storeRooms/{$storeRoom->id}", [
            'publication_status' => 'approved',
        ]);

        $response->assertStatus(200);
        $this->assertEqualsCanonicalizing(['data', 'message', 'status'], array_keys($response->json()));
        $response->assertJsonPath('message', 'Updated successfully');
        $response->assertJsonPath('status', 200);
        $response->assertJsonPath('data.id', $storeRoom->id);
        $response->assertJsonPath('data.publication_status', 'approved');
        $this->assertDatabaseCount('store_moderation', 1);
        $this->assertDatabaseCount('notifications', 1);
    }

    /**
     * Characterization (AMO-1): a rejection carries its reason through the
     * service and notifies the landlord with the rejection type.
     */
    public function test_admin_rejection_returns_the_same_shape_and_notifies_the_landlord()
    {
        $admin = User::factory()->create(['role' => 'admin']);
        Sanctum::actingAs($admin);

        $storeRoom = StoreRooms::factory()->create(['publication_status' => 'pending']);
        $storeRoom->load('landlord.user');

        $response = $this->putJson("/api/storeRooms/{$storeRoom->id}", [
            'publication_status' => 'rejected',
            'reason_code' => 'permiso',
            'reason_rejected' => 'Permiso de bomberos vencido',
        ]);

        $response->assertStatus(200);
        $this->assertEqualsCanonicalizing(['data', 'message', 'status'], array_keys($response->json()));
        $response->assertJsonPath('data.publication_status', 'rejected');
        $this->assertDatabaseCount('store_moderation', 1);
        $this->assertDatabaseHas('notifications', [
            'sender_id' => $admin->id,
            'receiver_id' => $storeRoom->landlord->user->id,
            'type' => 'store_rejected',
        ]);
    }

    private const NOT_A_DECISION_MESSAGE = 'Un administrador solo puede aprobar o rechazar una bodega con un estado distinto al actual; no se admiten otros cambios.';

    /**
     * @return array<string, array{0: string, 1: array<string, mixed>}>
     */
    public static function nonDecisionAdminPayloads(): array
    {
        return [
            'same status approved to approved' => ['approved', ['publication_status' => 'approved']],
            'same status rejected to rejected' => ['rejected', ['publication_status' => 'rejected', 'reason_code' => 'fotos']],
            'title only' => ['pending', ['title' => 'X']],
            'pending status' => ['approved', ['publication_status' => 'pending']],
            'unknown status' => ['pending', ['publication_status' => 'archived']],
            'missing status with a reason only' => ['pending', ['reason_code' => 'fotos', 'reason_rejected' => 'Sin fotos']],
        ];
    }

    /**
     * AMO-3: for an admin, anything that is not an approve/reject to a status
     * different from the current one is an explicit 422 (not the accidental
     * 404 of the landlord lookup) and writes nothing.
     */
    #[DataProvider('nonDecisionAdminPayloads')]
    public function test_an_admin_payload_that_is_not_a_decision_is_a_422_that_changes_nothing(string $currentStatus, array $payload)
    {
        $admin = User::factory()->create(['role' => 'admin']);
        Sanctum::actingAs($admin);

        $storeRoom = StoreRooms::factory()->withPhotos()->create([
            'publication_status' => $currentStatus,
            'title' => 'Original',
            'firefighter_permit_path' => 'firefighter_permits/permit.pdf',
        ]);

        $response = $this->putJson("/api/storeRooms/{$storeRoom->id}", $payload);

        $response->assertStatus(422);
        $response->assertJsonValidationErrors('publication_status');
        $response->assertJsonPath('message', self::NOT_A_DECISION_MESSAGE);
        $response->assertJsonPath('errors.publication_status.0', self::NOT_A_DECISION_MESSAGE);
        $this->assertDatabaseHas('storeRooms', [
            'id' => $storeRoom->id,
            'publication_status' => $currentStatus,
            'title' => 'Original',
        ]);
        $this->assertDatabaseCount('store_moderation', 0);
        $this->assertDatabaseCount('notifications', 0);
    }

    /**
     * AMO-3 (S9): relation keys alone must neither be honoured nor reach the
     * generic update tail that used to wipe photos, prices and history.
     */
    public function test_relation_keys_alone_are_a_422_and_every_related_row_stays_intact()
    {
        $admin = User::factory()->create(['role' => 'admin']);
        Sanctum::actingAs($admin);

        $storeRoom = $this->roomWithRelations();

        $response = $this->putJson("/api/storeRooms/{$storeRoom->id}", [
            'storePhotos' => [],
            'storePrices' => [],
            'moderations' => [],
        ]);

        $response->assertStatus(422);
        $response->assertJsonValidationErrors('publication_status');
        $this->assertRelatedRowsIntact($storeRoom, moderationRows: 1);
    }

    /**
     * AMO-3 (S10): ownership cannot be reassigned through the admin endpoint.
     */
    public function test_a_landlord_id_alone_is_a_422_and_the_owner_does_not_change()
    {
        $admin = User::factory()->create(['role' => 'admin']);
        Sanctum::actingAs($admin);

        $storeRoom = StoreRooms::factory()->withPhotos()->create(['publication_status' => 'pending']);
        $otherLandlord = Landlords::factory()->create();
        $originalOwner = $storeRoom->landlord_id;

        $response = $this->putJson("/api/storeRooms/{$storeRoom->id}", [
            'landlord_id' => $otherLandlord->id,
        ]);

        $response->assertStatus(422);
        $response->assertJsonValidationErrors('publication_status');
        $this->assertDatabaseHas('storeRooms', ['id' => $storeRoom->id, 'landlord_id' => $originalOwner]);
    }

    /**
     * AMO-4 (S11): keys other than the decision and its reason/waiver fields
     * have no effect next to a valid decision.
     */
    public function test_extra_keys_next_to_a_valid_decision_are_ignored()
    {
        $admin = User::factory()->create(['role' => 'admin']);
        Sanctum::actingAs($admin);

        $storeRoom = $this->roomWithRelations();
        $otherLandlord = Landlords::factory()->create();
        $originalOwner = $storeRoom->landlord_id;

        $response = $this->putJson("/api/storeRooms/{$storeRoom->id}", [
            'publication_status' => 'approved',
            'storePhotos' => [],
            'moderations' => [],
            'reservations' => [],
            'storePrices' => [],
            'landlord_id' => $otherLandlord->id,
            'title' => 'X',
        ]);

        $response->assertStatus(200);
        $this->assertDatabaseHas('storeRooms', [
            'id' => $storeRoom->id,
            'publication_status' => 'approved',
            'landlord_id' => $originalOwner,
            'title' => 'Original',
        ]);
        // The pre-existing history row stays and exactly one new row is added.
        $this->assertRelatedRowsIntact($storeRoom, moderationRows: 2);
    }

    /**
     * AMO-5 (S3): the photo guard fails the whole request before anything is
     * written, even with junk fields next to the decision.
     */
    public function test_approving_with_two_photos_and_junk_fields_writes_nothing()
    {
        $admin = User::factory()->create(['role' => 'admin']);
        Sanctum::actingAs($admin);

        $storeRoom = StoreRooms::factory()->withPhotos(2)->create([
            'publication_status' => 'pending',
            'title' => 'Original',
            'firefighter_permit_path' => 'firefighter_permits/permit.pdf',
        ]);

        $response = $this->putJson("/api/storeRooms/{$storeRoom->id}", [
            'publication_status' => 'approved',
            'title' => 'X',
            'landlord_id' => 999,
            'storePhotos' => [],
        ]);

        $response->assertStatus(422);
        $response->assertJsonValidationErrors('photos');
        $this->assertDatabaseHas('storeRooms', ['id' => $storeRoom->id, 'publication_status' => 'pending', 'title' => 'Original']);
        $this->assertDatabaseCount('store_moderation', 0);
        $this->assertDatabaseCount('notifications', 0);
        $this->assertSame(2, $storeRoom->storePhotos()->count());
    }

    /**
     * AMO-5 (S12): invalid listing fields next to a valid decision are ignored;
     * they must never fail the request after the room was already approved.
     */
    public function test_invalid_listing_fields_next_to_an_approval_are_ignored_instead_of_failing_after_the_commit()
    {
        $admin = User::factory()->create(['role' => 'admin']);
        Sanctum::actingAs($admin);

        $storeRoom = StoreRooms::factory()->withPhotos()->create([
            'publication_status' => 'pending',
            'firefighter_permit_path' => 'firefighter_permits/permit.pdf',
        ]);
        $originalStorageType = $storeRoom->storage_type;
        $originalRoomType = $storeRoom->room_type;

        $response = $this->putJson("/api/storeRooms/{$storeRoom->id}", [
            'publication_status' => 'approved',
            'storage_type' => 'completa ',
            'room_type' => 'x',
        ]);

        $response->assertStatus(200);
        $this->assertDatabaseHas('storeRooms', [
            'id' => $storeRoom->id,
            'publication_status' => 'approved',
            'storage_type' => $originalStorageType,
            'room_type' => $originalRoomType,
        ]);
        $this->assertDatabaseCount('store_moderation', 1);
    }

    /**
     * AMO-7 (S17): the mistyped enum values of the removed request class are
     * gone, so valid-looking listing fields do not validate or persist anything.
     */
    public function test_valid_looking_listing_fields_next_to_an_approval_are_ignored()
    {
        $admin = User::factory()->create(['role' => 'admin']);
        Sanctum::actingAs($admin);

        $storeRoom = StoreRooms::factory()->withPhotos()->create([
            'publication_status' => 'pending',
            'room_type' => 'garaje',
            'storage_type' => 'privado',
            'firefighter_permit_path' => 'firefighter_permits/permit.pdf',
        ]);

        $response = $this->putJson("/api/storeRooms/{$storeRoom->id}", [
            'publication_status' => 'approved',
            'room_type' => 'bodega',
            'storage_type' => 'completa',
        ]);

        $response->assertStatus(200);
        $this->assertDatabaseHas('storeRooms', [
            'id' => $storeRoom->id,
            'publication_status' => 'approved',
            'room_type' => 'garaje',
            'storage_type' => 'privado',
        ]);
    }

    /**
     * AMO-5 (S13): a rejection without the required reason code writes nothing.
     */
    public function test_a_rejection_without_a_reason_code_writes_nothing()
    {
        $admin = User::factory()->create(['role' => 'admin']);
        Sanctum::actingAs($admin);

        $storeRoom = StoreRooms::factory()->create(['publication_status' => 'pending']);

        $response = $this->putJson("/api/storeRooms/{$storeRoom->id}", [
            'publication_status' => 'rejected',
            'title' => 'X',
        ]);

        $response->assertStatus(422);
        $response->assertJsonValidationErrors('reason_code');
        $this->assertDatabaseHas('storeRooms', ['id' => $storeRoom->id, 'publication_status' => 'pending']);
        $this->assertDatabaseCount('store_moderation', 0);
        $this->assertDatabaseCount('notifications', 0);
    }

    /**
     * AMO-2 (S5): when body and query disagree, the body decision wins.
     */
    public function test_the_body_decision_wins_over_a_conflicting_query_string_status()
    {
        $admin = User::factory()->create(['role' => 'admin']);
        Sanctum::actingAs($admin);

        $storeRoom = StoreRooms::factory()->withPhotos()->create([
            'publication_status' => 'pending',
            'firefighter_permit_path' => 'firefighter_permits/permit.pdf',
        ]);

        $this->putJson("/api/storeRooms/{$storeRoom->id}?publication_status=pending", [
            'publication_status' => 'approved',
        ])->assertStatus(200);

        $this->assertDatabaseHas('storeRooms', ['id' => $storeRoom->id, 'publication_status' => 'approved']);
        $this->assertDatabaseCount('store_moderation', 1);
    }

    /**
     * AMO-2 + AMO-6 (S6): the owner edit path honours the body only, so a
     * query-string status cannot trigger the non-admin decision 403 nor change
     * the status.
     */
    public function test_a_query_string_status_does_not_affect_an_owner_edit()
    {
        $landlordUser = User::factory()->create(['role' => 'landlord']);
        $landlord = Landlords::factory()->create(['user_id' => $landlordUser->id]);
        Sanctum::actingAs($landlordUser);

        $storeRoom = StoreRooms::factory()->create([
            'landlord_id' => $landlord->id,
            'publication_status' => 'approved',
            'title' => 'Original',
        ]);

        $response = $this->putJson("/api/storeRooms/{$storeRoom->id}?publication_status=rejected", [
            'title' => 'Nuevo título',
        ]);

        $response->assertStatus(200);
        $this->assertDatabaseHas('storeRooms', ['id' => $storeRoom->id, 'title' => 'Nuevo título']);
        $this->assertDatabaseCount('store_moderation', 0);
        $this->assertNotSame('rejected', $storeRoom->fresh()->publication_status);
    }

    /**
     * AMO-7 (S16): the generic update request class and its typos are gone.
     * Checked on disk because an optimized autoloader built before the
     * deletion still lists the class and makes class_exists() throw instead of
     * answering false.
     */
    public function test_the_generic_update_store_room_request_class_no_longer_exists()
    {
        $this->assertFileDoesNotExist(app_path('Http/Requests/UpdateStoreRoomRequest.php'));
    }

    /**
     * A pending room with 3 photos, a price, an availability block, a
     * reservation and one earlier moderation row, to prove nothing is wiped.
     */
    private function roomWithRelations(): StoreRooms
    {
        $storeRoom = StoreRooms::factory()->withPhotos()->create([
            'publication_status' => 'pending',
            'title' => 'Original',
            'firefighter_permit_path' => 'firefighter_permits/permit.pdf',
        ]);
        StorePrices::factory()->create(['store_room_id' => $storeRoom->id]);
        StoreDisponibility::create([
            'store_room_id' => $storeRoom->id,
            'start_date' => '2030-01-01',
            'end_date' => '2030-01-05',
        ]);
        Reservations::factory()->create(['store_room_id' => $storeRoom->id]);
        StoreModeration::create([
            'store_id' => $storeRoom->id,
            'status' => 'rejected',
            'reason_rejected' => '',
            'reason_code' => 'fotos',
            'admin_id' => User::factory()->create(['role' => 'admin'])->id,
            'moderation_date' => now(),
        ]);

        return $storeRoom;
    }

    private function assertRelatedRowsIntact(StoreRooms $storeRoom, int $moderationRows): void
    {
        $this->assertSame(3, $storeRoom->storePhotos()->count());
        $this->assertSame(1, $storeRoom->storePrices()->count());
        $this->assertSame(1, $storeRoom->storeDisponibility()->count());
        $this->assertSame(1, $storeRoom->reservations()->count());
        $this->assertSame($moderationRows, $storeRoom->moderations()->count());
    }
}
