<?php

namespace Tests\Feature;

use App\Models\Ratings;
use App\Models\StoreRooms;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

/**
 * api-error-shape-unification: cross-cutting regression guard. Every one
 * of the mechanisms migrated across this cycle (ApiController's hand-rolled
 * validator, StoreRoomsController's inline checks, and a custom exception's
 * own render()) must produce a body with no `status` key, regardless of
 * which controller or exception class produced it. Individual controller
 * test files already pin the exact message/shape per endpoint; this file
 * only pins the absence of the legacy `status` body key across mechanisms.
 */
class ErrorShapeInvariantTest extends TestCase
{
    use RefreshDatabase;

    public function test_api_controller_generic_validation_error_has_no_status_key()
    {
        $caller = User::factory()->create();

        $response = $this->actingAs($caller, 'sanctum')->postJson('/api/landlords', [
            'user_id' => 999999,
        ]);

        $response->assertStatus(422);
        $response->assertJsonMissingPath('status');
    }

    public function test_api_controller_generic_not_found_has_no_status_key()
    {
        $response = $this->getJson('/api/landlords/999999');

        $response->assertStatus(404);
        $response->assertJsonMissingPath('status');
    }

    public function test_store_rooms_controller_inline_forbidden_check_has_no_status_key()
    {
        Storage::fake('private');
        $user = User::factory()->create(['role' => 'landlord']);

        $response = $this->actingAs($user, 'sanctum')->post('/api/storeRooms', [
            'room_type' => 'bodega',
            'storage_type' => 'completa',
            'direction' => 'Av. Carlos Julio Arosemena',
            'city' => 'Guayaquil',
            'size' => 45.5,
            'title' => 'Bodega Central Norte',
            'description' => 'Espacio amplio',
            'security' => 'Alta',
            'firefighter_permit' => UploadedFile::fake()->create('permiso.pdf', 100, 'application/pdf'),
            'cancellation_policy_tier' => 'flexible',
        ]);

        $response->assertStatus(403);
        $response->assertJsonMissingPath('status');
    }

    public function test_account_moderation_exception_self_render_has_no_status_key()
    {
        $admin = User::factory()->create(['role' => 'admin', 'state' => 'active']);

        $response = $this->actingAs($admin, 'sanctum')
            ->patchJson("/api/user/{$admin->id}/block", ['reason' => 'Motivo válido']);

        $response->assertStatus(403);
        $response->assertJsonMissingPath('status');
    }

    public function test_account_blocked_exception_self_render_has_no_status_key()
    {
        User::factory()->create([
            'email' => 'bloqueado@leodega.com',
            'password' => Hash::make('secret123'),
            'state' => 'blocked',
        ]);

        $response = $this->postJson('/api/login', [
            'email' => 'bloqueado@leodega.com',
            'password' => 'secret123',
        ]);

        $response->assertStatus(403);
        $response->assertJsonMissingPath('status');
    }

    public function test_ratings_duplicate_exception_self_render_has_no_status_key()
    {
        $user = User::factory()->create();
        $storeRoom = StoreRooms::factory()->create();

        Ratings::factory()->create([
            'store_id' => $storeRoom->id,
            'user_id' => $user->id,
        ]);

        $response = $this->actingAs($user, 'sanctum')->postJson('/api/ratings', [
            'store_id' => $storeRoom->id,
            'stars' => 3,
            'comment' => 'Repetido',
        ]);

        $response->assertStatus(409);
        $response->assertJsonMissingPath('status');
    }
}
