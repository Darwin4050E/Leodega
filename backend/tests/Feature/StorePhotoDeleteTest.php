<?php

namespace Tests\Feature;

use App\Models\Landlords;
use App\Models\StorePhoto;
use App\Models\StoreRooms;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Storage;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

/**
 * StorePhotoController::destroy — a room can never drop below
 * StoreRooms::MIN_PHOTOS photos, whatever its publication status.
 * Replacing a photo is add first, then delete.
 */
class StorePhotoDeleteTest extends TestCase
{
    use RefreshDatabase;

    private const MIN_MESSAGE = 'Una bodega debe conservar al menos 3 fotos. Sube la nueva foto antes de eliminar la anterior.';

    /**
     * @return array{0: User, 1: StoreRooms}
     */
    private function ownerWithRoom(int $photos, string $status = 'pending'): array
    {
        $user = User::factory()->create(['role' => 'landlord']);
        $landlord = Landlords::factory()->create(['user_id' => $user->id]);
        $room = StoreRooms::factory()->withPhotos($photos)->create([
            'landlord_id' => $landlord->id,
            'publication_status' => $status,
        ]);

        return [$user, $room];
    }

    public static function statusProvider(): array
    {
        return [
            'pending' => ['pending'],
            'approved' => ['approved'],
            'rejected' => ['rejected'],
        ];
    }

    #[DataProvider('statusProvider')]
    public function test_deleting_the_third_photo_is_rejected_regardless_of_status(string $status): void
    {
        Storage::fake('public');
        [$owner, $room] = $this->ownerWithRoom(3, $status);
        $photo = $room->storePhotos()->first();
        Storage::disk('public')->put($photo->photo_url, 'fake-bytes');

        $response = $this->actingAs($owner, 'sanctum')
            ->deleteJson("/api/store-rooms/{$room->id}/photos/{$photo->id}");

        $response->assertStatus(422);
        $response->assertJsonPath('errors.photos.0', self::MIN_MESSAGE);
        $this->assertSame(3, StorePhoto::where('store_room_id', $room->id)->count());
        Storage::disk('public')->assertExists($photo->photo_url);
    }

    public function test_deleting_when_the_room_already_has_fewer_than_three_is_rejected(): void
    {
        Storage::fake('public');
        [$owner, $room] = $this->ownerWithRoom(2);
        $photo = $room->storePhotos()->first();

        $response = $this->actingAs($owner, 'sanctum')
            ->deleteJson("/api/store-rooms/{$room->id}/photos/{$photo->id}");

        $response->assertStatus(422);
        $response->assertJsonValidationErrors('photos');
        $this->assertSame(2, StorePhoto::where('store_room_id', $room->id)->count());
    }

    public function test_deleting_with_four_photos_succeeds_and_leaves_three(): void
    {
        Storage::fake('public');
        [$owner, $room] = $this->ownerWithRoom(4, 'approved');
        $photo = $room->storePhotos()->first();
        Storage::disk('public')->put($photo->photo_url, 'fake-bytes');

        $response = $this->actingAs($owner, 'sanctum')
            ->deleteJson("/api/store-rooms/{$room->id}/photos/{$photo->id}");

        $response->assertStatus(200);
        $response->assertJsonPath('message', 'Photo deleted successfully');
        $this->assertDatabaseMissing('store_photo', ['id' => $photo->id]);
        $this->assertSame(3, StorePhoto::where('store_room_id', $room->id)->count());
        Storage::disk('public')->assertMissing($photo->photo_url);
    }

    public function test_add_first_then_delete_replaces_a_photo_on_a_three_photo_room(): void
    {
        Storage::fake('public');
        [$owner, $room] = $this->ownerWithRoom(3, 'approved');
        $old = $room->storePhotos()->first();
        StorePhoto::factory()->create(['store_room_id' => $room->id]);

        $response = $this->actingAs($owner, 'sanctum')
            ->deleteJson("/api/store-rooms/{$room->id}/photos/{$old->id}");

        $response->assertStatus(200);
        $this->assertSame(3, StorePhoto::where('store_room_id', $room->id)->count());
    }

    public function test_a_denied_delete_does_not_count_against_the_room_of_another_owner(): void
    {
        Storage::fake('public');
        [$owner, $room] = $this->ownerWithRoom(4);
        [, $other] = $this->ownerWithRoom(3);
        $foreign = $other->storePhotos()->first();

        $response = $this->actingAs($owner, 'sanctum')
            ->deleteJson("/api/store-rooms/{$room->id}/photos/{$foreign->id}");

        $response->assertStatus(404);
        $this->assertSame(3, StorePhoto::where('store_room_id', $other->id)->count());
    }
}
