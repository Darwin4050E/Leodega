<?php

namespace Tests\Feature;

use App\Models\Landlords;
use App\Models\Reservations;
use App\Models\StorePrices;
use App\Models\StoreRooms;
use App\Models\Tenants;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

/**
 * HUG-08: the owning gestor edits an already published storeroom
 * (title, description, size, monthly price + disponibility). The
 * moderation branch of PUT /storeRooms/{id} is exercised separately in
 * StoreRoomModerationTest.
 */
class StoreRoomUpdateTest extends TestCase
{
    use RefreshDatabase;

    private function makeLandlordUser(): array
    {
        $user = User::factory()->create(['role' => 'landlord']);
        $landlord = Landlords::factory()->create(['user_id' => $user->id]);

        return [$user, $landlord];
    }

    private function ownedRoom(Landlords $landlord, array $overrides = []): StoreRooms
    {
        return StoreRooms::factory()->create(array_merge([
            'landlord_id' => $landlord->id,
            'publication_status' => 'approved',
        ], $overrides));
    }

    private const REVIEW_NOTICE = 'Tu bodega volvió a revisión y dejará de estar disponible para nuevas reservas hasta que un administrador la apruebe.';

    private function assertStoreEditedNotifications(User $admin, User $sender, StoreRooms $room, int $expected): void
    {
        $this->assertSame(
            $expected,
            DB::table('notifications')
                ->where('receiver_id', $admin->id)
                ->where('sender_id', $sender->id)
                ->where('type', 'store_edited')
                ->count()
        );
    }

    // --- Scenario 1: happy path -------------------------------------------------

    public function test_owner_edits_scalar_fields_of_an_approved_room_and_it_goes_back_to_review()
    {
        [$user, $landlord] = $this->makeLandlordUser();
        $admin = User::factory()->create(['role' => 'admin']);
        $room = $this->ownedRoom($landlord, ['title' => 'Antiguo', 'size' => 20]);

        $response = $this->actingAs($user, 'sanctum')->putJson("/api/storeRooms/{$room->id}", [
            'title' => 'Bodega renovada',
            'description' => 'Ahora con mejor acceso',
            'size' => 55.5,
        ]);

        $response->assertStatus(200);
        $response->assertJson([
            'message' => 'Los cambios se guardaron correctamente.',
            'status' => 200,
            'requires_review' => true,
        ]);
        $response->assertJsonPath('review_notice', self::REVIEW_NOTICE);
        $response->assertJsonPath('data.publication_status', 'pending');
        $response->assertJsonMissingPath('notice');

        $this->assertDatabaseHas('storeRooms', [
            'id' => $room->id,
            'title' => 'Bodega renovada',
            'description' => 'Ahora con mejor acceso',
            'size' => 55.5,
            'publication_status' => 'pending',
        ]);
        $this->assertStoreEditedNotifications($admin, $user, $room, 1);
    }

    public function test_owner_edits_scalar_fields_of_a_pending_room_without_changing_its_status()
    {
        [$user, $landlord] = $this->makeLandlordUser();
        $admin = User::factory()->create(['role' => 'admin']);
        $room = $this->ownedRoom($landlord, ['publication_status' => 'pending', 'title' => 'Antiguo', 'size' => 20]);

        $response = $this->actingAs($user, 'sanctum')->putJson("/api/storeRooms/{$room->id}", [
            'title' => 'Bodega renovada',
            'description' => 'Ahora con mejor acceso',
            'size' => 55.5,
        ]);

        $response->assertStatus(200);
        $response->assertJsonPath('requires_review', false);
        $response->assertJsonMissingPath('review_notice');
        $response->assertJsonMissingPath('notice');
        $this->assertDatabaseHas('storeRooms', [
            'id' => $room->id,
            'title' => 'Bodega renovada',
            'size' => 55.5,
            'publication_status' => 'pending',
        ]);
        $this->assertStoreEditedNotifications($admin, $user, $room, 0);
    }

    public function test_owner_edits_monthly_price_and_other_price_rows_are_untouched()
    {
        [$user, $landlord] = $this->makeLandlordUser();
        $room = $this->ownedRoom($landlord);

        $monthly = StorePrices::factory()->create([
            'store_room_id' => $room->id,
            'mode' => 'month',
            'price' => 1000,
            'disponibility' => true,
        ]);
        $daily = StorePrices::factory()->create([
            'store_room_id' => $room->id,
            'mode' => 'day',
            'price' => 50,
            'disponibility' => true,
        ]);

        $response = $this->actingAs($user, 'sanctum')->putJson("/api/storeRooms/{$room->id}", [
            'price' => 1250.75,
            'disponibility' => false,
        ]);

        $response->assertStatus(200);
        $response->assertJsonPath('message', 'Los cambios se guardaron correctamente.');

        $this->assertDatabaseHas('store_prices', [
            'id' => $monthly->id,
            'mode' => 'month',
            'price' => 1250.75,
            'disponibility' => false,
        ]);
        $this->assertDatabaseHas('store_prices', [
            'id' => $daily->id,
            'mode' => 'day',
            'price' => 50,
            'disponibility' => true,
        ]);
        $this->assertDatabaseCount('store_prices', 2);
    }

    // --- Authorization / guards -----------------------------------------------

    public function test_non_owner_landlord_cannot_edit_and_nothing_changes()
    {
        [, $ownerLandlord] = $this->makeLandlordUser();
        $room = $this->ownedRoom($ownerLandlord, ['title' => 'Intacta']);

        [$otherUser] = $this->makeLandlordUser();

        $response = $this->actingAs($otherUser, 'sanctum')->putJson("/api/storeRooms/{$room->id}", [
            'title' => 'Secuestrada',
        ]);

        $response->assertStatus(403);
        $this->assertDatabaseHas('storeRooms', ['id' => $room->id, 'title' => 'Intacta']);
    }

    public function test_authenticated_user_without_landlord_profile_gets_404()
    {
        $user = User::factory()->create(['role' => 'landlord']);
        $room = StoreRooms::factory()->create();

        $response = $this->actingAs($user, 'sanctum')->putJson("/api/storeRooms/{$room->id}", [
            'title' => 'Nuevo',
        ]);

        $response->assertStatus(404);
    }

    public function test_nonexistent_room_gets_404()
    {
        [$user] = $this->makeLandlordUser();

        $response = $this->actingAs($user, 'sanctum')->putJson('/api/storeRooms/999999', [
            'title' => 'Nuevo',
        ]);

        $response->assertStatus(404);
    }

    public function test_soft_deleted_room_gets_404()
    {
        [$user, $landlord] = $this->makeLandlordUser();
        $room = $this->ownedRoom($landlord);
        $room->delete();

        $response = $this->actingAs($user, 'sanctum')->putJson("/api/storeRooms/{$room->id}", [
            'title' => 'Nuevo',
        ]);

        $response->assertStatus(404);
    }

    public function test_unauthenticated_request_cannot_edit()
    {
        [, $landlord] = $this->makeLandlordUser();
        $room = $this->ownedRoom($landlord, ['title' => 'Intacta']);

        $response = $this->putJson("/api/storeRooms/{$room->id}", ['title' => 'Hackeada']);

        $response->assertStatus(401);
        $this->assertDatabaseHas('storeRooms', ['id' => $room->id, 'title' => 'Intacta']);
    }

    // --- Scenario 2: validation is atomic ------------------------------------

    public function test_zero_price_is_rejected_and_nothing_is_saved()
    {
        [$user, $landlord] = $this->makeLandlordUser();
        $room = $this->ownedRoom($landlord, ['title' => 'Intacta']);
        StorePrices::factory()->create(['store_room_id' => $room->id, 'mode' => 'month', 'price' => 1000]);

        $response = $this->actingAs($user, 'sanctum')->putJson("/api/storeRooms/{$room->id}", [
            'title' => 'Cambiada',
            'price' => 0,
        ]);

        $response->assertStatus(422);
        $response->assertJsonValidationErrors(['price']);
        $this->assertDatabaseHas('storeRooms', ['id' => $room->id, 'title' => 'Intacta']);
        $this->assertDatabaseHas('store_prices', ['store_room_id' => $room->id, 'price' => 1000]);
    }

    public function test_negative_price_is_rejected()
    {
        [$user, $landlord] = $this->makeLandlordUser();
        $room = $this->ownedRoom($landlord);

        $response = $this->actingAs($user, 'sanctum')->putJson("/api/storeRooms/{$room->id}", [
            'price' => -5,
        ]);

        $response->assertStatus(422);
        $response->assertJsonValidationErrors(['price']);
        $response->assertJsonPath('message', 'Validation Error');
        $response->assertJsonMissingPath('status');
    }

    public function test_invalid_size_values_are_rejected_and_nothing_is_saved()
    {
        [$user, $landlord] = $this->makeLandlordUser();
        $room = $this->ownedRoom($landlord, ['size' => 30]);

        foreach ([0, -10, 'no-soy-un-numero'] as $badSize) {
            $response = $this->actingAs($user, 'sanctum')->putJson("/api/storeRooms/{$room->id}", [
                'size' => $badSize,
            ]);

            $response->assertStatus(422);
            $response->assertJsonValidationErrors(['size']);
        }

        $this->assertDatabaseHas('storeRooms', ['id' => $room->id, 'size' => 30]);
    }

    public function test_size_above_the_column_limit_is_rejected_and_nothing_is_saved()
    {
        [$user, $landlord] = $this->makeLandlordUser();
        $room = $this->ownedRoom($landlord, ['size' => 30]);

        $response = $this->actingAs($user, 'sanctum')->putJson("/api/storeRooms/{$room->id}", [
            'size' => 100000000,
        ]);

        $response->assertStatus(422);
        $response->assertJsonValidationErrors(['size']);
        $this->assertDatabaseHas('storeRooms', ['id' => $room->id, 'size' => 30]);
    }

    public function test_size_at_the_column_limit_is_accepted_on_edit()
    {
        [$user, $landlord] = $this->makeLandlordUser();
        $room = $this->ownedRoom($landlord, ['size' => 30]);

        $this->actingAs($user, 'sanctum')->putJson("/api/storeRooms/{$room->id}", [
            'size' => 99999999.99,
        ])->assertStatus(200);
    }

    public function test_price_change_on_room_without_monthly_tariff_row_is_a_clear_error()
    {
        [$user, $landlord] = $this->makeLandlordUser();
        $room = $this->ownedRoom($landlord, ['title' => 'Intacta']);
        // only a daily row exists — no mode='month'
        StorePrices::factory()->create(['store_room_id' => $room->id, 'mode' => 'day', 'price' => 40]);

        $response = $this->actingAs($user, 'sanctum')->putJson("/api/storeRooms/{$room->id}", [
            'title' => 'Cambiada',
            'price' => 900,
        ]);

        $response->assertStatus(422);
        $response->assertJsonValidationErrors(['price']);
        // atomic: the title change rolled back too
        $this->assertDatabaseHas('storeRooms', ['id' => $room->id, 'title' => 'Intacta']);
    }

    // --- Scenario 3: existing reservations ----------------------------------

    public function test_edit_is_allowed_with_confirmed_future_reservation_and_returns_notice()
    {
        [$user, $landlord] = $this->makeLandlordUser();
        $room = $this->ownedRoom($landlord);
        StorePrices::factory()->create([
            'store_room_id' => $room->id,
            'mode' => 'month',
            'price' => 1000,
        ]);

        $reservation = Reservations::factory()->create([
            'store_room_id' => $room->id,
            'status' => 'confirmed',
            'end_date' => now()->addDays(20),
            'total_mount' => 100,
            'rent_subtotal' => 80,
        ]);

        $response = $this->actingAs($user, 'sanctum')->putJson("/api/storeRooms/{$room->id}", [
            'price' => 1500,
            'size' => 99,
        ]);

        $response->assertStatus(200);
        $response->assertJsonPath('message', 'Los cambios se guardaron correctamente.');
        $response->assertJsonPath(
            'notice',
            'Los cambios no afectan a las reservas ya confirmadas; solo aplican a nuevas reservas.'
        );

        // new terms applied to the listing
        $this->assertDatabaseHas('store_prices', ['store_room_id' => $room->id, 'mode' => 'month', 'price' => 1500]);
        // existing contract keeps its snapshot
        $this->assertDatabaseHas('reservations', [
            'id' => $reservation->id,
            'total_mount' => 100,
            'rent_subtotal' => 80,
        ]);
    }

    public function test_no_notice_when_only_past_or_canceled_reservations_exist()
    {
        [$user, $landlord] = $this->makeLandlordUser();
        $room = $this->ownedRoom($landlord);

        Reservations::factory()->create([
            'store_room_id' => $room->id,
            'status' => 'confirmed',
            'end_date' => now()->subDays(3),
        ]);
        Reservations::factory()->create([
            'store_room_id' => $room->id,
            'status' => 'canceled',
            'end_date' => now()->addDays(3),
        ]);

        $response = $this->actingAs($user, 'sanctum')->putJson("/api/storeRooms/{$room->id}", [
            'title' => 'Sin contratos vivos',
        ]);

        $response->assertStatus(200);
        $response->assertJsonMissingPath('notice');
    }

    // --- Out-of-scope fields are ignored ------------------------------------

    public function test_landlord_id_and_publication_status_in_payload_are_ignored()
    {
        [$user, $landlord] = $this->makeLandlordUser();
        $otherLandlord = Landlords::factory()->create();
        $room = $this->ownedRoom($landlord, ['publication_status' => 'rejected']);

        $response = $this->actingAs($user, 'sanctum')->putJson("/api/storeRooms/{$room->id}", [
            'title' => 'Solo el título cambia',
            'landlord_id' => $otherLandlord->id,
            'publication_status' => 'pending',
        ]);

        $response->assertStatus(200);
        $this->assertDatabaseHas('storeRooms', [
            'id' => $room->id,
            'title' => 'Solo el título cambia',
            'landlord_id' => $landlord->id,
            'publication_status' => 'rejected',
        ]);
    }

    public function test_owner_cannot_approve_a_pending_room_through_the_edit_payload()
    {
        [$user, $landlord] = $this->makeLandlordUser();
        $otherLandlord = Landlords::factory()->create();
        $room = $this->ownedRoom($landlord, ['publication_status' => 'pending', 'title' => 'Intacta']);

        $response = $this->actingAs($user, 'sanctum')->putJson("/api/storeRooms/{$room->id}", [
            'title' => 'Intento de auto-aprobación',
            'landlord_id' => $otherLandlord->id,
            'publication_status' => 'approved',
        ]);

        $response->assertStatus(403);
        $this->assertDatabaseHas('storeRooms', [
            'id' => $room->id,
            'title' => 'Intacta',
            'landlord_id' => $landlord->id,
            'publication_status' => 'pending',
        ]);
    }

    // --- Edit moderation: material edits re-queue an approved room -------------

    public static function materialFieldProvider(): array
    {
        return [
            'title' => [['title' => 'Otro título']],
            'description' => [['description' => 'Otra descripción']],
            'size' => [['size' => 75.25]],
            'price' => [['price' => 1999.5]],
        ];
    }

    #[DataProvider('materialFieldProvider')]
    public function test_each_material_field_alone_sends_an_approved_room_back_to_review(array $payload)
    {
        [$user, $landlord] = $this->makeLandlordUser();
        $admin = User::factory()->create(['role' => 'admin']);
        $room = $this->ownedRoom($landlord, ['title' => 'Original', 'description' => 'Texto', 'size' => 20]);
        StorePrices::factory()->create(['store_room_id' => $room->id, 'mode' => 'month', 'price' => 1000]);

        $response = $this->actingAs($user, 'sanctum')->putJson("/api/storeRooms/{$room->id}", $payload);

        $response->assertStatus(200);
        $response->assertJsonPath('requires_review', true);
        $response->assertJsonPath('review_notice', self::REVIEW_NOTICE);
        $this->assertDatabaseHas('storeRooms', ['id' => $room->id, 'publication_status' => 'pending']);
        $this->assertStoreEditedNotifications($admin, $user, $room, 1);
    }

    public function test_resending_unchanged_values_does_not_send_an_approved_room_back_to_review()
    {
        [$user, $landlord] = $this->makeLandlordUser();
        $admin = User::factory()->create(['role' => 'admin']);
        $room = $this->ownedRoom($landlord, ['title' => 'Original', 'description' => 'Texto', 'size' => 20]);
        StorePrices::factory()->create(['store_room_id' => $room->id, 'mode' => 'month', 'price' => 1000]);

        $response = $this->actingAs($user, 'sanctum')->putJson("/api/storeRooms/{$room->id}", [
            'title' => 'Original',
            'description' => 'Texto',
            'size' => 20,
            'price' => 1000,
        ]);

        $response->assertStatus(200);
        $response->assertJsonPath('requires_review', false);
        $response->assertJsonMissingPath('review_notice');
        $this->assertDatabaseHas('storeRooms', ['id' => $room->id, 'publication_status' => 'approved']);
        $this->assertStoreEditedNotifications($admin, $user, $room, 0);
    }

    public function test_an_invalid_edit_keeps_the_approved_room_approved_and_notifies_nobody()
    {
        [$user, $landlord] = $this->makeLandlordUser();
        $admin = User::factory()->create(['role' => 'admin']);
        $room = $this->ownedRoom($landlord, ['title' => 'Original']);
        StorePrices::factory()->create(['store_room_id' => $room->id, 'mode' => 'month', 'price' => 1000]);

        $this->actingAs($user, 'sanctum')->putJson("/api/storeRooms/{$room->id}", [
            'title' => 'Cambiada',
            'price' => 0,
        ])->assertStatus(422);

        $this->assertDatabaseHas('storeRooms', ['id' => $room->id, 'title' => 'Original', 'publication_status' => 'approved']);
        $this->assertStoreEditedNotifications($admin, $user, $room, 0);
    }

    public function test_a_price_edit_that_fails_in_the_service_keeps_the_approved_room_approved()
    {
        [$user, $landlord] = $this->makeLandlordUser();
        $admin = User::factory()->create(['role' => 'admin']);
        $room = $this->ownedRoom($landlord, ['title' => 'Original']);
        StorePrices::factory()->create(['store_room_id' => $room->id, 'mode' => 'day', 'price' => 40]);

        $this->actingAs($user, 'sanctum')->putJson("/api/storeRooms/{$room->id}", [
            'title' => 'Cambiada',
            'price' => 900,
        ])->assertStatus(422);

        $this->assertDatabaseHas('storeRooms', ['id' => $room->id, 'title' => 'Original', 'publication_status' => 'approved']);
        $this->assertStoreEditedNotifications($admin, $user, $room, 0);
    }

    public function test_disponibility_only_edit_keeps_the_room_approved_and_notifies_nobody()
    {
        [$user, $landlord] = $this->makeLandlordUser();
        $admin = User::factory()->create(['role' => 'admin']);
        $room = $this->ownedRoom($landlord);
        $monthly = StorePrices::factory()->create([
            'store_room_id' => $room->id,
            'mode' => 'month',
            'price' => 1000,
            'disponibility' => true,
        ]);

        $response = $this->actingAs($user, 'sanctum')->putJson("/api/storeRooms/{$room->id}", [
            'disponibility' => false,
        ]);

        $response->assertStatus(200);
        $response->assertJsonPath('requires_review', false);
        $response->assertJsonMissingPath('review_notice');
        $this->assertDatabaseHas('store_prices', ['id' => $monthly->id, 'disponibility' => false]);
        $this->assertDatabaseHas('storeRooms', ['id' => $room->id, 'publication_status' => 'approved']);
        $this->assertStoreEditedNotifications($admin, $user, $room, 0);
    }

    public function test_title_plus_disponibility_applies_both_and_sends_the_room_back_to_review_once()
    {
        [$user, $landlord] = $this->makeLandlordUser();
        $admin = User::factory()->create(['role' => 'admin']);
        $room = $this->ownedRoom($landlord, ['title' => 'Original']);
        $monthly = StorePrices::factory()->create([
            'store_room_id' => $room->id,
            'mode' => 'month',
            'price' => 1000,
            'disponibility' => true,
        ]);

        $this->actingAs($user, 'sanctum')->putJson("/api/storeRooms/{$room->id}", [
            'title' => 'Nuevo nombre',
            'disponibility' => false,
        ])->assertStatus(200)->assertJsonPath('requires_review', true);

        $this->assertDatabaseHas('storeRooms', ['id' => $room->id, 'title' => 'Nuevo nombre', 'publication_status' => 'pending']);
        $this->assertDatabaseHas('store_prices', ['id' => $monthly->id, 'disponibility' => false]);
        $this->assertStoreEditedNotifications($admin, $user, $room, 1);
    }

    public function test_editing_a_pending_room_does_not_notify_admins_again()
    {
        [$user, $landlord] = $this->makeLandlordUser();
        $admin = User::factory()->create(['role' => 'admin']);
        $room = $this->ownedRoom($landlord, ['publication_status' => 'pending']);
        StorePrices::factory()->create(['store_room_id' => $room->id, 'mode' => 'month', 'price' => 1000]);

        $this->actingAs($user, 'sanctum')->putJson("/api/storeRooms/{$room->id}", [
            'title' => 'Otro título',
            'price' => 1500,
        ])->assertStatus(200)->assertJsonPath('requires_review', false);

        $this->assertDatabaseHas('storeRooms', ['id' => $room->id, 'title' => 'Otro título', 'publication_status' => 'pending']);
        $this->assertStoreEditedNotifications($admin, $user, $room, 0);
    }

    public function test_editing_a_rejected_room_keeps_it_rejected_and_notifies_nobody()
    {
        [$user, $landlord] = $this->makeLandlordUser();
        $admin = User::factory()->create(['role' => 'admin']);
        $room = $this->ownedRoom($landlord, ['publication_status' => 'rejected']);
        $monthly = StorePrices::factory()->create(['store_room_id' => $room->id, 'mode' => 'month', 'price' => 1000]);

        $this->actingAs($user, 'sanctum')->putJson("/api/storeRooms/{$room->id}", [
            'price' => 1300,
        ])->assertStatus(200)->assertJsonPath('requires_review', false);

        $this->assertDatabaseHas('storeRooms', ['id' => $room->id, 'publication_status' => 'rejected']);
        $this->assertDatabaseHas('store_prices', ['id' => $monthly->id, 'price' => 1300]);
        $this->assertStoreEditedNotifications($admin, $user, $room, 0);
        $this->assertDatabaseCount('notifications', 0);
    }

    // --- Edit moderation: unique title per landlord ----------------------------

    public function test_editing_to_a_title_used_by_another_room_of_the_same_landlord_is_rejected()
    {
        [$user, $landlord] = $this->makeLandlordUser();
        $this->ownedRoom($landlord, ['title' => 'Bodega Sur']);
        $room = $this->ownedRoom($landlord, ['title' => 'Bodega Norte']);

        $response = $this->actingAs($user, 'sanctum')->putJson("/api/storeRooms/{$room->id}", [
            'title' => 'Bodega Sur',
        ]);

        $response->assertStatus(422);
        $response->assertJsonPath('message', 'Validation Error');
        $response->assertJsonValidationErrors(['title']);
        $response->assertJsonPath('errors.title.0', 'Ya tienes una bodega publicada con ese nombre. Elige otro nombre para continuar.');
        $this->assertDatabaseHas('storeRooms', ['id' => $room->id, 'title' => 'Bodega Norte', 'publication_status' => 'approved']);
    }

    public function test_resending_the_rooms_own_title_is_accepted()
    {
        [$user, $landlord] = $this->makeLandlordUser();
        $room = $this->ownedRoom($landlord, ['title' => 'Bodega Sur']);

        $this->actingAs($user, 'sanctum')->putJson("/api/storeRooms/{$room->id}", [
            'title' => 'Bodega Sur',
            'description' => 'Texto nuevo',
        ])->assertStatus(200);

        $this->assertDatabaseHas('storeRooms', ['id' => $room->id, 'description' => 'Texto nuevo']);
    }

    public function test_a_title_held_only_by_a_soft_deleted_room_of_the_same_landlord_is_accepted()
    {
        [$user, $landlord] = $this->makeLandlordUser();
        $deleted = $this->ownedRoom($landlord, ['title' => 'Liberado']);
        $deleted->delete();
        $room = $this->ownedRoom($landlord, ['title' => 'Bodega Norte']);

        $this->actingAs($user, 'sanctum')->putJson("/api/storeRooms/{$room->id}", [
            'title' => 'Liberado',
        ])->assertStatus(200);

        $this->assertDatabaseHas('storeRooms', ['id' => $room->id, 'title' => 'Liberado']);
    }

    public function test_a_title_used_by_another_landlord_is_accepted()
    {
        [$user, $landlord] = $this->makeLandlordUser();
        [, $otherLandlord] = $this->makeLandlordUser();
        $this->ownedRoom($otherLandlord, ['title' => 'Compartido']);
        $room = $this->ownedRoom($landlord, ['title' => 'Bodega Norte']);

        $this->actingAs($user, 'sanctum')->putJson("/api/storeRooms/{$room->id}", [
            'title' => 'Compartido',
        ])->assertStatus(200);

        $this->assertDatabaseHas('storeRooms', ['id' => $room->id, 'title' => 'Compartido']);
    }

    // --- Edit moderation: a pending room is not bookable -----------------------

    public function test_a_requeued_room_is_hidden_from_tenants_and_cannot_be_reserved()
    {
        [$landlordUser, $landlord] = $this->makeLandlordUser();
        $room = $this->ownedRoom($landlord, ['title' => 'Original']);
        StorePrices::factory()->create([
            'store_room_id' => $room->id,
            'mode' => 'month',
            'price' => 1000,
            'disponibility' => true,
        ]);
        $tenantUser = User::factory()->create();
        Tenants::factory()->create(['user_id' => $tenantUser->id]);

        $this->actingAs($landlordUser, 'sanctum')->putJson("/api/storeRooms/{$room->id}", [
            'title' => 'Editada',
        ])->assertStatus(200);

        $this->actingAs($tenantUser, 'sanctum')->getJson("/api/storeRooms/{$room->id}")->assertStatus(404);
        $this->actingAs($tenantUser, 'sanctum')->postJson('/api/reservations', [
            'store_room_id' => $room->id,
            'start_date' => today()->startOfMonth()->addMonth()->toDateString(),
            'end_date' => today()->startOfMonth()->addMonths(4)->toDateString(),
        ])->assertStatus(404);

        $this->assertDatabaseCount('reservations', 0);
    }

    public function test_admin_approval_makes_a_requeued_room_bookable_again()
    {
        [$landlordUser, $landlord] = $this->makeLandlordUser();
        $room = StoreRooms::factory()->approved()->withPhotos()->create([
            'landlord_id' => $landlord->id,
            'title' => 'Original',
            'security' => json_encode(['camara' => true]),
            'firefighter_permit_path' => 'firefighter_permits/permit.pdf',
        ]);
        StorePrices::factory()->create([
            'store_room_id' => $room->id,
            'mode' => 'month',
            'price' => 1000,
            'disponibility' => true,
        ]);
        $admin = User::factory()->create(['role' => 'admin']);
        $tenantUser = User::factory()->create();
        Tenants::factory()->create(['user_id' => $tenantUser->id]);

        $this->actingAs($landlordUser, 'sanctum')->putJson("/api/storeRooms/{$room->id}", [
            'title' => 'Editada',
        ])->assertStatus(200);

        $this->actingAs($admin, 'sanctum')->putJson("/api/storeRooms/{$room->id}", [
            'publication_status' => 'approved',
        ])->assertStatus(200);

        $this->actingAs($tenantUser, 'sanctum')->getJson("/api/storeRooms/{$room->id}")->assertStatus(200);
        $this->actingAs($tenantUser, 'sanctum')->postJson('/api/reservations', [
            'store_room_id' => $room->id,
            'start_date' => today()->startOfMonth()->addMonth()->toDateString(),
            'end_date' => today()->startOfMonth()->addMonths(4)->toDateString(),
        ])->assertStatus(201);
    }

    public function test_editing_a_room_with_a_confirmed_reservation_requeues_it_and_leaves_the_reservation_untouched()
    {
        [$user, $landlord] = $this->makeLandlordUser();
        $admin = User::factory()->create(['role' => 'admin']);
        $room = $this->ownedRoom($landlord);
        StorePrices::factory()->create(['store_room_id' => $room->id, 'mode' => 'month', 'price' => 1000]);
        $reservation = Reservations::factory()->create([
            'store_room_id' => $room->id,
            'status' => 'confirmed',
            'end_date' => now()->addDays(20),
            'total_mount' => 100,
            'rent_subtotal' => 80,
        ]);

        $response = $this->actingAs($user, 'sanctum')->putJson("/api/storeRooms/{$room->id}", [
            'price' => 1500,
        ]);

        $response->assertStatus(200);
        $response->assertJsonPath('requires_review', true);
        $response->assertJsonPath(
            'notice',
            'Los cambios no afectan a las reservas ya confirmadas; solo aplican a nuevas reservas.'
        );
        $this->assertDatabaseHas('storeRooms', ['id' => $room->id, 'publication_status' => 'pending']);
        $this->assertDatabaseHas('reservations', [
            'id' => $reservation->id,
            'status' => 'confirmed',
            'total_mount' => 100,
            'rent_subtotal' => 80,
        ]);
        $this->assertStoreEditedNotifications($admin, $user, $room, 1);
    }
}
