<?php

namespace Tests\Feature;

use App\Models\Landlords;
use App\Models\StoreRooms;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * GET /landlords/{id}/storeRooms exposes, per room, the latest rejection
 * (`rejection: {reason_code, reason}`) so the owning gestor can see why a
 * listing was rejected. Non-rejected rooms carry `rejection: null`.
 * The owner-facing detail payload also carries `publication_status`.
 */
class StoreRoomRejectionReasonTest extends TestCase
{
    use RefreshDatabase;

    private function makeOwner(): array
    {
        $user = User::factory()->create(['role' => 'landlord']);
        $landlord = Landlords::factory()->create(['user_id' => $user->id]);

        return [$user, $landlord];
    }

    private function roomFrom(array $body, int $id): ?array
    {
        return collect($body)->firstWhere('id', $id);
    }

    public function test_rejected_room_exposes_its_latest_rejection(): void
    {
        [$user, $landlord] = $this->makeOwner();
        $admin = User::factory()->create(['role' => 'admin']);
        $room = StoreRooms::factory()->create([
            'landlord_id' => $landlord->id,
            'publication_status' => 'rejected',
        ]);

        $room->moderations()->create([
            'status' => 'rejected',
            'reason_code' => 'fotos',
            'reason_rejected' => 'Fotos borrosas',
            'admin_id' => $admin->id,
            'moderation_date' => now()->subDays(2),
        ]);
        $room->moderations()->create([
            'status' => 'rejected',
            'reason_code' => 'permiso',
            'reason_rejected' => 'El permiso está vencido',
            'admin_id' => $admin->id,
            'moderation_date' => now()->subDay(),
        ]);

        $response = $this->actingAs($user, 'sanctum')
            ->getJson("/api/landlords/{$landlord->id}/storeRooms");

        $response->assertStatus(200);
        $this->assertSame(
            ['reason_code' => 'permiso', 'reason' => 'El permiso está vencido'],
            $this->roomFrom($response->json(), $room->id)['rejection'],
        );
    }

    public function test_empty_free_text_reason_is_exposed_as_null(): void
    {
        [$user, $landlord] = $this->makeOwner();
        $room = StoreRooms::factory()->create([
            'landlord_id' => $landlord->id,
            'publication_status' => 'rejected',
        ]);
        $room->moderations()->create([
            'status' => 'rejected',
            'reason_code' => 'otro',
            'reason_rejected' => '',
            'moderation_date' => now(),
        ]);

        $response = $this->actingAs($user, 'sanctum')
            ->getJson("/api/landlords/{$landlord->id}/storeRooms");

        $response->assertStatus(200);
        $this->assertSame(
            ['reason_code' => 'otro', 'reason' => null],
            $this->roomFrom($response->json(), $room->id)['rejection'],
        );
    }

    public function test_approved_and_pending_rooms_have_null_rejection(): void
    {
        [$user, $landlord] = $this->makeOwner();
        $approved = StoreRooms::factory()->create([
            'landlord_id' => $landlord->id,
            'publication_status' => 'approved',
        ]);
        $pending = StoreRooms::factory()->create([
            'landlord_id' => $landlord->id,
            'publication_status' => 'pending',
        ]);
        // A resubmitted room keeps its old rejection row in history; it must
        // not leak once the room is no longer rejected.
        $pending->moderations()->create([
            'status' => 'rejected',
            'reason_code' => 'info',
            'reason_rejected' => 'Descripción incompleta',
            'moderation_date' => now()->subDay(),
        ]);

        $response = $this->actingAs($user, 'sanctum')
            ->getJson("/api/landlords/{$landlord->id}/storeRooms");

        $response->assertStatus(200);
        $body = $response->json();
        $this->assertArrayHasKey('rejection', $this->roomFrom($body, $approved->id));
        $this->assertNull($this->roomFrom($body, $approved->id)['rejection']);
        $this->assertNull($this->roomFrom($body, $pending->id)['rejection']);
    }

    public function test_other_viewer_never_sees_rejected_rooms_or_their_reason(): void
    {
        [, $landlord] = $this->makeOwner();
        $rejected = StoreRooms::factory()->create([
            'landlord_id' => $landlord->id,
            'publication_status' => 'rejected',
        ]);
        $rejected->moderations()->create([
            'status' => 'rejected',
            'reason_code' => 'fotos',
            'reason_rejected' => 'Fotos borrosas',
            'moderation_date' => now(),
        ]);
        StoreRooms::factory()->create([
            'landlord_id' => $landlord->id,
            'publication_status' => 'approved',
        ]);

        $response = $this->getJson("/api/landlords/{$landlord->id}/storeRooms");

        $response->assertStatus(200);
        $this->assertSame(['approved'], collect($response->json())->pluck('publication_status')->all());
        $this->assertNull($this->roomFrom($response->json(), $rejected->id));
    }

    /**
     * The gestor's edit screen loads GET /store-rooms/{id}/detail and needs
     * publication_status to decide whether to offer "Reenviar a revisión".
     */
    public function test_detail_exposes_publication_status_to_the_owner(): void
    {
        [$user, $landlord] = $this->makeOwner();
        $room = StoreRooms::factory()->create([
            'landlord_id' => $landlord->id,
            'publication_status' => 'rejected',
        ]);

        $this->actingAs($user, 'sanctum')
            ->getJson("/api/store-rooms/{$room->id}/detail")
            ->assertStatus(200)
            ->assertJsonPath('publication_status', 'rejected');
    }
}
