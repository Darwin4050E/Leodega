<?php

namespace Tests\Feature;

use App\Models\Landlords;
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

    /**
     * @return array{0: User, 1: StoreRooms}
     */
    private function ownerWithRoom(): array
    {
        $user = User::factory()->create(['role' => 'landlord']);
        $landlord = Landlords::factory()->create(['user_id' => $user->id]);

        return [$user, StoreRooms::factory()->create(['landlord_id' => $landlord->id])];
    }

    public function test_fewer_than_three_photos_is_rejected(): void
    {
        Storage::fake('public');
        [$owner, $room] = $this->ownerWithRoom();

        $response = $this->actingAs($owner, 'sanctum')->postJson(
            "/api/store-rooms/{$room->id}/photos",
            ['photos' => [UploadedFile::fake()->image('a.jpg'), UploadedFile::fake()->image('b.jpg')]],
        );

        $response->assertStatus(422);
        $response->assertJsonPath('errors.photos.0', 'Debe adjuntar al menos 3 fotos de la bodega.');
        $this->assertSame(0, StorePhoto::count());
    }

    public function test_three_photos_are_accepted(): void
    {
        Storage::fake('public');
        [$owner, $room] = $this->ownerWithRoom();

        $response = $this->actingAs($owner, 'sanctum')->postJson(
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

    /**
     * @return array<int, UploadedFile>
     */
    private function jpegs(int $count): array
    {
        return array_map(
            fn (int $i) => UploadedFile::fake()->create("photo-{$i}.jpg", 100, 'image/jpeg'),
            range(1, $count),
        );
    }

    public function test_two_photos_are_rejected_without_needing_gd(): void
    {
        Storage::fake('public');
        [$owner, $room] = $this->ownerWithRoom();

        $response = $this->actingAs($owner, 'sanctum')->postJson(
            "/api/store-rooms/{$room->id}/photos",
            ['photos' => $this->jpegs(2)],
        );

        $response->assertStatus(422);
        $response->assertJsonPath('errors.photos.0', 'Debe adjuntar al menos 3 fotos de la bodega.');
        $this->assertSame(0, StorePhoto::count());
    }

    public function test_three_photos_are_accepted_without_needing_gd(): void
    {
        Storage::fake('public');
        [$owner, $room] = $this->ownerWithRoom();

        $response = $this->actingAs($owner, 'sanctum')->postJson(
            "/api/store-rooms/{$room->id}/photos",
            ['photos' => $this->jpegs(3)],
        );

        $response->assertStatus(201);
        $this->assertSame(3, StorePhoto::where('store_room_id', $room->id)->count());
    }

    public function test_the_cap_counts_photos_the_room_already_has(): void
    {
        Storage::fake('public');
        [$owner, $room] = $this->ownerWithRoom();
        StorePhoto::factory()->count(8)->create(['store_room_id' => $room->id]);

        $response = $this->actingAs($owner, 'sanctum')->postJson(
            "/api/store-rooms/{$room->id}/photos",
            ['photos' => $this->jpegs(3)],
        );

        $response->assertStatus(422);
        $response->assertJsonValidationErrors('photos');
        $this->assertSame(8, StorePhoto::where('store_room_id', $room->id)->count());
        $this->assertSame([], Storage::disk('public')->allFiles());
    }

    public function test_a_room_can_reach_exactly_ten_photos(): void
    {
        Storage::fake('public');
        [$owner, $room] = $this->ownerWithRoom();
        StorePhoto::factory()->count(7)->create(['store_room_id' => $room->id]);

        $response = $this->actingAs($owner, 'sanctum')->postJson(
            "/api/store-rooms/{$room->id}/photos",
            ['photos' => $this->jpegs(3)],
        );

        $response->assertStatus(201);
        $this->assertSame(10, StorePhoto::where('store_room_id', $room->id)->count());
    }

    public function test_eleven_photos_in_one_request_are_rejected(): void
    {
        Storage::fake('public');
        [$owner, $room] = $this->ownerWithRoom();

        $response = $this->actingAs($owner, 'sanctum')->postJson(
            "/api/store-rooms/{$room->id}/photos",
            ['photos' => $this->jpegs(11)],
        );

        $response->assertStatus(422);
        $response->assertJsonValidationErrors('photos');
        $this->assertSame(0, StorePhoto::count());
        $this->assertSame([], Storage::disk('public')->allFiles());
    }

    public function test_the_minimum_of_three_applies_per_request_even_when_the_room_has_photos(): void
    {
        Storage::fake('public');
        [$owner, $room] = $this->ownerWithRoom();
        StorePhoto::factory()->count(3)->create(['store_room_id' => $room->id]);

        $response = $this->actingAs($owner, 'sanctum')->postJson(
            "/api/store-rooms/{$room->id}/photos",
            ['photos' => $this->jpegs(2)],
        );

        $response->assertStatus(422);
        $response->assertJsonPath('errors.photos.0', 'Debe adjuntar al menos 3 fotos de la bodega.');
        $this->assertSame(3, StorePhoto::where('store_room_id', $room->id)->count());
    }
}
