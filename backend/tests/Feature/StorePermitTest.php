<?php

namespace Tests\Feature;

use App\Models\StoreRooms;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

/**
 * Feature tests for StorePermitController::download.
 *
 * The permit is only ever written during atomic room registration
 * (StoreRoomService::register); there is no separate upload endpoint.
 * These tests cover the admin-only download action.
 */
class StorePermitTest extends TestCase
{
    use RefreshDatabase;

    private function makeUser(string $role): User
    {
        return User::factory()->create(['role' => $role]);
    }

    public function test_download_permit_requires_authentication(): void
    {
        $storeRoom = StoreRooms::factory()->create();

        $response = $this->getJson("/api/store-rooms/{$storeRoom->id}/permit/download");

        $response->assertStatus(401);
    }

    public function test_download_permit_is_forbidden_for_non_admin(): void
    {
        $landlord = $this->makeUser('landlord');
        $storeRoom = StoreRooms::factory()->create();

        $response = $this->actingAs($landlord, 'sanctum')
            ->getJson("/api/store-rooms/{$storeRoom->id}/permit/download");

        $response->assertStatus(403);
    }

    public function test_download_permit_returns_file_for_admin(): void
    {
        Storage::fake('private');

        $admin = $this->makeUser('admin');
        $storeRoom = StoreRooms::factory()->create();

        $path = 'firefighter_permits/test_permit.pdf';
        Storage::disk('private')->put($path, 'fake pdf content');
        $storeRoom->update(['firefighter_permit_path' => $path]);

        $response = $this->actingAs($admin, 'sanctum')
            ->get("/api/store-rooms/{$storeRoom->id}/permit/download");

        $response->assertStatus(200)
            ->assertHeader('Content-Disposition');
    }

    public function test_download_permit_returns_404_when_no_permit(): void
    {
        Storage::fake('private');

        $admin = $this->makeUser('admin');
        $storeRoom = StoreRooms::factory()->create(['firefighter_permit_path' => null]);

        $response = $this->actingAs($admin, 'sanctum')
            ->getJson("/api/store-rooms/{$storeRoom->id}/permit/download");

        $response->assertStatus(404);
    }
}
