<?php

namespace Tests\Feature;

use App\Models\Landlords;
use App\Models\StorePhoto;
use App\Models\StoreRooms;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\Storage;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

/**
 * sdd/sanctum-crud-ownership-audit-c: photo upload and delete on a store room
 * are owner-only; delete resolves the photo from its own URL parameter scoped
 * to the room in the URL. The public photo list is unchanged.
 */
class StorePhotoOwnershipTest extends TestCase
{
    use RefreshDatabase;

    /**
     * Real Bearer token, no `actingAs`: `actingAs` masks the guard. One request
     * per test method keeps the memoized guard from leaking.
     */
    private function bearerAs(User $user): static
    {
        $this->app['auth']->forgetGuards();

        return $this->withToken($user->createToken('auth_token')->plainTextToken);
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

        return $this->bearerAs($user);
    }

    /**
     * @return array{0: User, 1: StoreRooms}
     */
    private function ownerWithRoom(): array
    {
        $user = User::factory()->create(['role' => 'landlord']);
        $landlord = Landlords::factory()->create(['user_id' => $user->id]);

        return [$user, StoreRooms::factory()->create(['landlord_id' => $landlord->id])];
    }

    private function seedPhoto(StoreRooms $room, string $name): StorePhoto
    {
        $path = "store_photos/{$name}.jpg";
        Storage::disk('public')->put($path, 'fake-bytes');

        return StorePhoto::create(['store_room_id' => $room->id, 'photo_url' => $path]);
    }

    /**
     * @return array<int, UploadedFile>
     */
    private function fakePhotos(int $count = 3): array
    {
        return array_map(
            fn (int $i) => UploadedFile::fake()->create("p{$i}.jpg", 100, 'image/jpeg'),
            range(1, $count),
        );
    }

    /**
     * @return array{rows: array<int, array<string, mixed>>, files: array<int, string>}
     */
    private function snapshot(): array
    {
        return [
            'rows' => DB::table('store_photo')->orderBy('id')->get()->map(fn ($row) => (array) $row)->all(),
            'files' => Storage::disk('public')->allFiles(),
        ];
    }

    public function test_public_index_lists_only_the_rooms_own_photos(): void
    {
        Storage::fake('public');
        [, $room] = $this->ownerWithRoom();
        [, $other] = $this->ownerWithRoom();
        $mine = $this->seedPhoto($room, 'mine');
        $this->seedPhoto($other, 'theirs');

        $response = $this->getJson("/api/store-rooms/{$room->id}/photos");

        $response->assertStatus(200);
        $response->assertJsonCount(1);
        $response->assertJsonPath('0.id', $mine->id);
        $response->assertJsonPath('0.store_room_id', $room->id);
    }

    public function test_photo_route_surface(): void
    {
        $routes = collect(Route::getRoutes()->getRoutes())
            ->filter(fn ($route) => str_starts_with($route->uri(), 'api/store-rooms/{storeRoom}/photos'));

        $surface = $routes
            ->map(fn ($route) => implode('|', $route->methods()).' '.$route->uri())
            ->sort()
            ->values()
            ->all();

        $this->assertSame([
            'DELETE api/store-rooms/{storeRoom}/photos/{photo}',
            'GET|HEAD api/store-rooms/{storeRoom}/photos',
            'POST api/store-rooms/{storeRoom}/photos',
        ], $surface);

        foreach ($routes as $route) {
            $isRead = in_array('GET', $route->methods(), true);
            $isRead
                ? $this->assertNotContains('auth.api:sanctum', $route->gatherMiddleware())
                : $this->assertContains('auth.api:sanctum', $route->gatherMiddleware());
        }
    }

    public static function uploadDenialProvider(): array
    {
        return [
            'anonymous' => [null, 401],
            'non-owner landlord' => ['landlord', 403],
            'tenant without landlord profile' => ['tenant', 404],
        ];
    }

    #[DataProvider('uploadDenialProvider')]
    public function test_upload_is_denied_without_creating_rows_or_files(?string $role, int $status): void
    {
        Storage::fake('public');
        [, $room] = $this->ownerWithRoom();
        $before = $this->snapshot();

        $response = $this->callerAs($role)->postJson(
            "/api/store-rooms/{$room->id}/photos",
            ['photos' => $this->fakePhotos()],
        );

        $this->assertSame($before, $this->snapshot());
        $response->assertStatus($status);
    }

    public function test_owner_uploads_three_photos_without_gd(): void
    {
        Storage::fake('public');
        [$owner, $room] = $this->ownerWithRoom();

        $response = $this->bearerAs($owner)->postJson(
            "/api/store-rooms/{$room->id}/photos",
            ['photos' => $this->fakePhotos()],
        );

        $response->assertStatus(201);
        $response->assertJsonPath('message', 'Photos uploaded successfully');
        $response->assertJsonCount(3, 'data');
        $this->assertSame(3, StorePhoto::where('store_room_id', $room->id)->count());
        $this->assertCount(3, Storage::disk('public')->allFiles());
    }

    public function test_upload_to_a_nonexistent_room_is_404_for_a_landlord(): void
    {
        Storage::fake('public');
        $before = $this->snapshot();

        $response = $this->callerAs('landlord')->postJson(
            '/api/store-rooms/999999/photos',
            ['photos' => $this->fakePhotos()],
        );

        $this->assertSame($before, $this->snapshot());
        $response->assertStatus(404);
    }

    public function test_upload_to_a_soft_deleted_room_is_404_even_for_its_owner(): void
    {
        Storage::fake('public');
        [$owner, $room] = $this->ownerWithRoom();
        $room->delete();
        $before = $this->snapshot();

        $response = $this->bearerAs($owner)->postJson(
            "/api/store-rooms/{$room->id}/photos",
            ['photos' => $this->fakePhotos()],
        );

        $this->assertSame($before, $this->snapshot());
        $response->assertStatus(404);
    }

    public function test_denial_precedes_validation_for_a_non_owner(): void
    {
        Storage::fake('public');
        [, $room] = $this->ownerWithRoom();
        $before = $this->snapshot();

        $response = $this->callerAs('landlord')->postJson(
            "/api/store-rooms/{$room->id}/photos",
            ['photos' => $this->fakePhotos(1)],
        );

        $this->assertSame($before, $this->snapshot());
        $response->assertStatus(403);
    }

    public static function deleteDenialProvider(): array
    {
        return [
            'anonymous' => [null, 401],
            'non-owner landlord' => ['landlord', 403],
        ];
    }

    #[DataProvider('deleteDenialProvider')]
    public function test_delete_is_denied_and_the_photo_persists(?string $role, int $status): void
    {
        Storage::fake('public');
        [, $room] = $this->ownerWithRoom();
        $photo = $this->seedPhoto($room, 'target');
        $before = $this->snapshot();

        $response = $this->callerAs($role)->deleteJson("/api/store-rooms/{$room->id}/photos/{$photo->id}");

        $this->assertSame($before, $this->snapshot());
        $response->assertStatus($status);
    }

    public function test_owner_deletes_own_photo_row_and_file(): void
    {
        Storage::fake('public');
        [$owner, $room] = $this->ownerWithRoom();
        $photo = $this->seedPhoto($room, 'mine');

        $response = $this->bearerAs($owner)->deleteJson("/api/store-rooms/{$room->id}/photos/{$photo->id}");

        $response->assertStatus(200);
        $response->assertJsonPath('message', 'Photo deleted successfully');
        $this->assertDatabaseMissing('store_photo', ['id' => $photo->id]);
        Storage::disk('public')->assertMissing($photo->photo_url);
    }

    public function test_owner_cannot_delete_a_photo_of_another_room(): void
    {
        Storage::fake('public');
        [$owner, $roomA] = $this->ownerWithRoom();
        [, $roomB] = $this->ownerWithRoom();
        $foreign = $this->seedPhoto($roomB, 'foreign');
        $before = $this->snapshot();

        $response = $this->bearerAs($owner)->deleteJson("/api/store-rooms/{$roomA->id}/photos/{$foreign->id}");

        $this->assertSame($before, $this->snapshot());
        $response->assertStatus(404);
    }

    public function test_owner_deleting_a_nonexistent_photo_is_404(): void
    {
        Storage::fake('public');
        [$owner, $room] = $this->ownerWithRoom();
        $this->seedPhoto($room, 'kept');
        $before = $this->snapshot();

        $response = $this->bearerAs($owner)->deleteJson("/api/store-rooms/{$room->id}/photos/999999");

        $this->assertSame($before, $this->snapshot());
        $response->assertStatus(404);
    }

    public function test_delete_in_a_nonexistent_room_is_404_for_a_landlord(): void
    {
        Storage::fake('public');
        [, $room] = $this->ownerWithRoom();
        $photo = $this->seedPhoto($room, 'kept');
        $before = $this->snapshot();

        $response = $this->callerAs('landlord')->deleteJson("/api/store-rooms/999999/photos/{$photo->id}");

        $this->assertSame($before, $this->snapshot());
        $response->assertStatus(404);
    }

    public function test_delete_resolves_the_photo_from_its_own_url_parameter_not_the_room_id(): void
    {
        Storage::fake('public');
        [$owner, $roomA] = $this->ownerWithRoom();
        [, $roomB] = $this->ownerWithRoom();

        // Q carries the id of room A but belongs to room B; P is A's own photo.
        $qPath = 'store_photos/q.jpg';
        Storage::disk('public')->put($qPath, 'fake-bytes');
        DB::table('store_photo')->insertGetId([
            'id' => $roomA->id,
            'store_room_id' => $roomB->id,
            'photo_url' => $qPath,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
        $p = $this->seedPhoto($roomA, 'p');
        $this->assertNotSame($roomA->id, $p->id);

        $response = $this->bearerAs($owner)->deleteJson("/api/store-rooms/{$roomA->id}/photos/{$p->id}");

        $response->assertStatus(200);
        $this->assertDatabaseMissing('store_photo', ['id' => $p->id]);
        $this->assertDatabaseHas('store_photo', ['id' => $roomA->id, 'store_room_id' => $roomB->id]);
        Storage::disk('public')->assertMissing($p->photo_url);
        Storage::disk('public')->assertExists($qPath);
    }
}
