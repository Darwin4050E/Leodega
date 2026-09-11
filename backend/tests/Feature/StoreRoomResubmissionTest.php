<?php

namespace Tests\Feature;

use App\Models\Landlords;
use App\Models\StoreRooms;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * POST /storeRooms/{id}/resubmit — spec #175 "store-room-resubmission".
 * Ownership (403) and "not currently rejected" (409) are two SEPARATE
 * failures, verified independently below (decision #5).
 */
class StoreRoomResubmissionTest extends TestCase
{
    use RefreshDatabase;

    private function ownerAndRoom(string $status = 'rejected'): array
    {
        $user = User::factory()->create(['role' => 'landlord']);
        $landlord = Landlords::factory()->create(['user_id' => $user->id]);
        $room = StoreRooms::factory()->create([
            'landlord_id' => $landlord->id,
            'publication_status' => $status,
        ]);

        return [$user, $landlord, $room];
    }

    public function test_unauthenticated_caller_is_rejected()
    {
        [, , $room] = $this->ownerAndRoom();

        $response = $this->postJson("/api/storeRooms/{$room->id}/resubmit");

        $response->assertStatus(401);
    }

    public function test_non_owner_is_forbidden()
    {
        [, , $room] = $this->ownerAndRoom();
        $otherUser = User::factory()->create(['role' => 'landlord']);
        Landlords::factory()->create(['user_id' => $otherUser->id]);

        $response = $this->actingAs($otherUser, 'sanctum')->postJson("/api/storeRooms/{$room->id}/resubmit");

        $response->assertStatus(403);

        $this->assertDatabaseHas('storeRooms', [
            'id' => $room->id,
            'publication_status' => 'rejected',
        ]);
    }

    public function test_owner_resubmitting_a_pending_room_fails_with_a_state_conflict()
    {
        [$user, , $room] = $this->ownerAndRoom('pending');

        $response = $this->actingAs($user, 'sanctum')->postJson("/api/storeRooms/{$room->id}/resubmit");

        $response->assertStatus(409);

        $this->assertDatabaseHas('storeRooms', [
            'id' => $room->id,
            'publication_status' => 'pending',
        ]);
    }

    public function test_owner_resubmitting_an_approved_room_fails_with_a_state_conflict()
    {
        [$user, , $room] = $this->ownerAndRoom('approved');

        $response = $this->actingAs($user, 'sanctum')->postJson("/api/storeRooms/{$room->id}/resubmit");

        $response->assertStatus(409);

        $this->assertDatabaseHas('storeRooms', [
            'id' => $room->id,
            'publication_status' => 'approved',
        ]);
    }

    public function test_owner_resubmits_a_rejected_room_successfully()
    {
        [$user, , $room] = $this->ownerAndRoom('rejected');

        $response = $this->actingAs($user, 'sanctum')->postJson("/api/storeRooms/{$room->id}/resubmit");

        $response->assertStatus(200);

        $this->assertDatabaseHas('storeRooms', [
            'id' => $room->id,
            'publication_status' => 'pending',
        ]);
    }

    public function test_resubmission_without_any_prior_edit_still_succeeds()
    {
        [$user, , $room] = $this->ownerAndRoom('rejected');

        // No field is edited between rejection and resubmission —
        // addendum #174.3 explicitly forbids requiring one.
        $response = $this->actingAs($user, 'sanctum')->postJson("/api/storeRooms/{$room->id}/resubmit");

        $response->assertStatus(200);
    }

    public function test_all_admins_receive_a_resubmission_notification()
    {
        [$user, , $room] = $this->ownerAndRoom('rejected');
        $admin1 = User::factory()->create(['role' => 'admin']);
        $admin2 = User::factory()->create(['role' => 'admin']);

        $this->actingAs($user, 'sanctum')->postJson("/api/storeRooms/{$room->id}/resubmit")
            ->assertStatus(200);

        $this->assertDatabaseHas('notifications', [
            'sender_id' => $user->id,
            'receiver_id' => $admin1->id,
            'type' => 'store_resubmitted',
        ]);
        $this->assertDatabaseHas('notifications', [
            'sender_id' => $user->id,
            'receiver_id' => $admin2->id,
            'type' => 'store_resubmitted',
        ]);
    }

    public function test_prior_moderation_row_is_neither_deleted_nor_mutated()
    {
        [$user, , $room] = $this->ownerAndRoom('rejected');
        $priorModeration = $room->moderations()->create([
            'status' => 'rejected',
            'reason_code' => 'fotos',
            'reason_rejected' => 'Fotos borrosas',
            'moderation_date' => now()->subDay(),
        ]);

        $this->actingAs($user, 'sanctum')->postJson("/api/storeRooms/{$room->id}/resubmit")
            ->assertStatus(200);

        $this->assertDatabaseHas('store_moderation', [
            'id' => $priorModeration->id,
            'status' => 'rejected',
            'reason_code' => 'fotos',
            'reason_rejected' => 'Fotos borrosas',
        ]);
        $this->assertDatabaseCount('store_moderation', 1);
    }

    public function test_authenticated_user_without_landlord_profile_gets_404()
    {
        [, , $room] = $this->ownerAndRoom();
        $tenant = User::factory()->create(['role' => 'tenant']);

        $response = $this->actingAs($tenant, 'sanctum')->postJson("/api/storeRooms/{$room->id}/resubmit");

        $response->assertStatus(404);
    }

    public function test_nonexistent_room_gets_404()
    {
        $user = User::factory()->create(['role' => 'landlord']);
        Landlords::factory()->create(['user_id' => $user->id]);

        $response = $this->actingAs($user, 'sanctum')->postJson('/api/storeRooms/999999/resubmit');

        $response->assertStatus(404);
    }
}
