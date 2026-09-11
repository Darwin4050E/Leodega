<?php

namespace Tests\Feature;

use App\Models\StorePhoto;
use App\Models\StoreRooms;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

/**
 * StorePhotoController::store — a published listing needs at least three
 * photos, matching the web and mobile wizards and the prototype.
 */
class StoreRoomPhotoUploadTest extends TestCase
{
    use RefreshDatabase;

    private function landlord(): User
    {
        return User::factory()->create(['role' => 'landlord']);
    }

    public function test_fewer_than_three_photos_is_rejected(): void
    {
        Storage::fake('public');
        $room = StoreRooms::factory()->create();

        $response = $this->actingAs($this->landlord(), 'sanctum')->postJson(
            "/api/store-rooms/{$room->id}/photos",
            ['photos' => [UploadedFile::fake()->image('a.jpg'), UploadedFile::fake()->image('b.jpg')]],
        );

        $response->assertStatus(400);
        $response->assertJsonPath('errors.photos.0', 'Debe adjuntar al menos 3 fotos de la bodega.');
        $this->assertSame(0, StorePhoto::count());
    }

    public function test_three_photos_are_accepted(): void
    {
        Storage::fake('public');
        $room = StoreRooms::factory()->create();

        $response = $this->actingAs($this->landlord(), 'sanctum')->postJson(
            "/api/store-rooms/{$room->id}/photos",
            ['photos' => [
                UploadedFile::fake()->image('a.jpg'),
                UploadedFile::fake()->image('b.jpg'),
                UploadedFile::fake()->image('c.jpg'),
            ]],
        );

        $response->assertStatus(201);
        $this->assertSame(3, StorePhoto::where('store_room_id', $room->id)->count());
    }
}
