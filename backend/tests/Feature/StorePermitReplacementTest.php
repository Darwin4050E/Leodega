<?php

namespace Tests\Feature;

use App\Models\Landlords;
use App\Models\StoreRooms;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

/**
 * POST /store-rooms/{storeRoom}/permit — the owning gestor replaces the
 * fire-department permit PDF. Ownership mirrors editListing() (404 without
 * landlord profile, 403 when not the owner); an approved room goes back to
 * moderation, rejected/pending rooms keep their status.
 */
class StorePermitReplacementTest extends TestCase
{
    use RefreshDatabase;

    private const OLD_PATH = 'firefighter_permits/old_permit.pdf';

    protected function setUp(): void
    {
        parent::setUp();

        Storage::fake('private');
    }

    private function ownerAndRoom(string $status = 'approved'): array
    {
        $user = User::factory()->create(['role' => 'landlord']);
        $landlord = Landlords::factory()->create(['user_id' => $user->id]);

        Storage::disk('private')->put(self::OLD_PATH, 'old pdf content');
        $room = StoreRooms::factory()->withPhotos()->create([
            'landlord_id' => $landlord->id,
            'publication_status' => $status,
            'firefighter_permit_path' => self::OLD_PATH,
        ]);

        return [$user, $room];
    }

    private function pdf(int $kilobytes = 100): UploadedFile
    {
        return UploadedFile::fake()->create('permiso.pdf', $kilobytes, 'application/pdf');
    }

    private function replace(User $user, StoreRooms $room, array $payload)
    {
        return $this->actingAs($user, 'sanctum')
            ->post("/api/store-rooms/{$room->id}/permit", $payload, ['Accept' => 'application/json']);
    }

    public function test_unauthenticated_caller_is_rejected(): void
    {
        [, $room] = $this->ownerAndRoom();

        $this->post("/api/store-rooms/{$room->id}/permit", ['firefighter_permit' => $this->pdf()], ['Accept' => 'application/json'])
            ->assertStatus(401);
    }

    public function test_unknown_room_returns_404(): void
    {
        [$user] = $this->ownerAndRoom();

        $this->actingAs($user, 'sanctum')
            ->post('/api/store-rooms/999999/permit', ['firefighter_permit' => $this->pdf()], ['Accept' => 'application/json'])
            ->assertStatus(404);
    }

    public function test_user_without_landlord_profile_gets_404(): void
    {
        [, $room] = $this->ownerAndRoom();
        $stranger = User::factory()->create(['role' => 'landlord']);

        $this->replace($stranger, $room, ['firefighter_permit' => $this->pdf()])
            ->assertStatus(404);

        $this->assertSame(self::OLD_PATH, $room->fresh()->firefighter_permit_path);
    }

    public function test_landlord_cannot_replace_another_landlords_permit(): void
    {
        [, $room] = $this->ownerAndRoom();
        $otherUser = User::factory()->create(['role' => 'landlord']);
        Landlords::factory()->create(['user_id' => $otherUser->id]);

        $this->replace($otherUser, $room, ['firefighter_permit' => $this->pdf()])
            ->assertStatus(403);

        $this->assertSame(self::OLD_PATH, $room->fresh()->firefighter_permit_path);
        Storage::disk('private')->assertExists(self::OLD_PATH);
    }

    public function test_missing_file_fails_validation(): void
    {
        [$user, $room] = $this->ownerAndRoom();

        $this->replace($user, $room, [])
            ->assertStatus(422)
            ->assertJsonPath('message', 'Validation Error')
            ->assertJsonPath('errors.firefighter_permit.0', 'Debe adjuntar el permiso de bomberos vigente para continuar.');
    }

    public function test_non_pdf_file_fails_validation(): void
    {
        [$user, $room] = $this->ownerAndRoom();
        $file = UploadedFile::fake()->create('permiso.txt', 10, 'text/plain');

        $this->replace($user, $room, ['firefighter_permit' => $file])
            ->assertStatus(422)
            ->assertJsonPath('errors.firefighter_permit.0', 'El permiso debe ser un archivo PDF.');

        $this->assertSame(self::OLD_PATH, $room->fresh()->firefighter_permit_path);
    }

    public function test_file_larger_than_5mb_fails_validation(): void
    {
        [$user, $room] = $this->ownerAndRoom();

        $this->replace($user, $room, ['firefighter_permit' => $this->pdf(5121)])
            ->assertStatus(422)
            ->assertJsonPath('errors.firefighter_permit.0', 'El permiso no debe superar los 5 MB.');

        $this->assertSame(self::OLD_PATH, $room->fresh()->firefighter_permit_path);
    }

    public function test_owner_replaces_the_permit(): void
    {
        [$user, $room] = $this->ownerAndRoom('pending');

        $response = $this->replace($user, $room, ['firefighter_permit' => $this->pdf()]);

        $response->assertStatus(200)
            ->assertJsonPath('data.id', $room->id)
            ->assertJsonMissingPath('data.firefighter_permit_path');
        $this->assertIsString($response->json('message'));

        $newPath = $room->fresh()->firefighter_permit_path;
        $this->assertNotSame(self::OLD_PATH, $newPath);
        $this->assertStringStartsWith('firefighter_permits/', $newPath);
        Storage::disk('private')->assertExists($newPath);
        Storage::disk('private')->assertMissing(self::OLD_PATH);
    }

    public function test_approved_room_goes_back_to_pending_and_admins_are_notified(): void
    {
        [$user, $room] = $this->ownerAndRoom('approved');
        $admin = User::factory()->create(['role' => 'admin']);

        $this->replace($user, $room, ['firefighter_permit' => $this->pdf()])
            ->assertStatus(200)
            ->assertJsonPath('data.publication_status', 'pending');

        $this->assertDatabaseHas('storeRooms', ['id' => $room->id, 'publication_status' => 'pending']);
        $this->assertDatabaseHas('notifications', [
            'sender_id' => $user->id,
            'receiver_id' => $admin->id,
            'type' => 'store_permit_replaced',
        ]);
    }

    public function test_rejected_room_stays_rejected_and_can_then_be_resubmitted(): void
    {
        [$user, $room] = $this->ownerAndRoom('rejected');
        $admin = User::factory()->create(['role' => 'admin']);

        $this->replace($user, $room, ['firefighter_permit' => $this->pdf()])
            ->assertStatus(200)
            ->assertJsonPath('data.publication_status', 'rejected');

        $this->assertDatabaseHas('storeRooms', ['id' => $room->id, 'publication_status' => 'rejected']);
        $this->assertDatabaseMissing('notifications', ['receiver_id' => $admin->id]);

        $this->actingAs($user, 'sanctum')->postJson("/api/storeRooms/{$room->id}/resubmit")
            ->assertStatus(200);

        $this->assertDatabaseHas('storeRooms', ['id' => $room->id, 'publication_status' => 'pending']);
    }

    public function test_pending_room_stays_pending_without_notifying_admins(): void
    {
        [$user, $room] = $this->ownerAndRoom('pending');
        $admin = User::factory()->create(['role' => 'admin']);

        $this->replace($user, $room, ['firefighter_permit' => $this->pdf()])
            ->assertStatus(200)
            ->assertJsonPath('data.publication_status', 'pending');

        $this->assertDatabaseHas('storeRooms', ['id' => $room->id, 'publication_status' => 'pending']);
        $this->assertDatabaseMissing('notifications', ['receiver_id' => $admin->id]);
    }

    public function test_admin_download_returns_the_replaced_permit(): void
    {
        [$user, $room] = $this->ownerAndRoom('approved');
        $admin = User::factory()->create(['role' => 'admin']);
        $newPdf = UploadedFile::fake()->createWithContent('permiso.pdf', '%PDF-1.4 new permit');

        $this->replace($user, $room, ['firefighter_permit' => $newPdf])->assertStatus(200);

        $response = $this->actingAs($admin, 'sanctum')
            ->get("/api/store-rooms/{$room->id}/permit/download");

        $response->assertStatus(200);
        $this->assertSame('%PDF-1.4 new permit', $response->streamedContent());
    }
}
