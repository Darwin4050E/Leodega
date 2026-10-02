<?php

namespace Tests\Feature;

use App\Models\Landlords;
use App\Models\StoreRooms;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

class StoreRoomShowTest extends TestCase
{
    use RefreshDatabase;

    private const NOT_FOUND = ['message' => 'Bodega no encontrada'];

    private const SECURITY = '{"camara":true,"ruido":false,"control":true,"acceso":true}';

    private function roomWithPermit(string $status): StoreRooms
    {
        return StoreRooms::factory()->create([
            'publication_status' => $status,
            'security' => self::SECURITY,
            'firefighter_permit_path' => 'firefighter_permits/secret.pdf',
        ]);
    }

    private function callerAs(?string $role): static
    {
        if ($role === null) {
            return $this;
        }

        $user = User::factory()->create(['role' => $role]);
        if ($role === 'landlord') {
            Landlords::factory()->create(['user_id' => $user->id]);
        }

        return $this->actingAs($user, 'sanctum');
    }

    public static function visibleViewerProvider(): array
    {
        return [
            'visitor' => [null],
            'tenant' => ['tenant'],
        ];
    }

    public static function hiddenRoomProvider(): array
    {
        return [
            'visitor pending' => [null, 'pending'],
            'tenant rejected' => ['tenant', 'rejected'],
            'non-owner landlord pending' => ['landlord', 'pending'],
        ];
    }

    public static function anonymousAndAdminProvider(): array
    {
        return [
            'anonymous' => [null],
            'admin' => ['admin'],
        ];
    }

    #[DataProvider('visibleViewerProvider')]
    public function test_approved_room_is_visible_without_permit_path(?string $role)
    {
        $room = $this->roomWithPermit('approved');

        $response = $this->callerAs($role)->getJson("/api/storeRooms/{$room->id}");

        $response->assertStatus(200);
        $response->assertJsonPath('id', $room->id);
        $response->assertJsonMissingPath('firefighter_permit_path');
    }

    #[DataProvider('hiddenRoomProvider')]
    public function test_hidden_room_returns_exact_404_for_non_privileged_viewers(?string $role, string $status)
    {
        $room = $this->roomWithPermit($status);

        $response = $this->callerAs($role)->getJson("/api/storeRooms/{$room->id}");

        $response->assertStatus(404);
        $response->assertExactJson(self::NOT_FOUND);
    }

    public function test_owner_and_admin_read_pending_room_without_permit_path()
    {
        $ownerUser = User::factory()->create(['role' => 'landlord']);
        $owner = Landlords::factory()->create(['user_id' => $ownerUser->id]);
        $room = StoreRooms::factory()->create([
            'landlord_id' => $owner->id,
            'publication_status' => 'pending',
            'security' => self::SECURITY,
            'firefighter_permit_path' => 'firefighter_permits/secret.pdf',
        ]);

        $asOwner = $this->actingAs($ownerUser, 'sanctum')->getJson("/api/storeRooms/{$room->id}");
        $asOwner->assertStatus(200);
        $asOwner->assertJsonPath('id', $room->id);
        $asOwner->assertJsonMissingPath('firefighter_permit_path');

        $asAdmin = $this->callerAs('admin')->getJson("/api/storeRooms/{$room->id}");
        $asAdmin->assertStatus(200);
        $asAdmin->assertJsonPath('id', $room->id);
        $asAdmin->assertJsonMissingPath('firefighter_permit_path');
    }

    public function test_missing_room_returns_exact_404()
    {
        $response = $this->getJson('/api/storeRooms/999999');

        $response->assertStatus(404);
        $response->assertExactJson(self::NOT_FOUND);
    }

    #[DataProvider('anonymousAndAdminProvider')]
    public function test_soft_deleted_room_returns_404(?string $role)
    {
        $room = $this->roomWithPermit('approved');
        $room->delete();

        $response = $this->callerAs($role)->getJson("/api/storeRooms/{$room->id}");

        $response->assertStatus(404);
        $response->assertExactJson(self::NOT_FOUND);
    }

    public function test_model_hidden_is_untouched_by_show()
    {
        $room = $this->roomWithPermit('approved');

        $this->getJson("/api/storeRooms/{$room->id}")->assertStatus(200);

        $this->assertSame(
            'firefighter_permits/secret.pdf',
            StoreRooms::find($room->id)->toArray()['firefighter_permit_path']
        );
    }
}
