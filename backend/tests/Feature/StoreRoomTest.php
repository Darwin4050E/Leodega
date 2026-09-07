<?php

namespace Tests\Feature;

use App\Models\Landlords;
use App\Models\StorePhoto;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class StoreRoomTest extends TestCase
{
    use RefreshDatabase; // Limpia la base de datos de memoria en cada ejecución

    protected function setUp(): void
    {
        parent::setUp();

        Storage::fake('private');
    }

    private function validPayload(array $overrides = []): array
    {
        return array_merge([
            'room_type' => 'bodega',
            'storage_type' => 'completa',
            'direction' => 'Av. Carlos Julio Arosemena',
            'city' => 'Guayaquil',
            'size' => 45.5,
            'title' => 'Bodega Central Norte',
            'description' => 'Espacio amplio',
            'security' => 'Alta',
            'firefighter_permit' => $this->fakePermit(),
            'cancellation_policy_tier' => 'flexible',
        ], $overrides);
    }

    private function fakePermit(string $name = 'permiso.pdf', int $kilobytes = 100): UploadedFile
    {
        return UploadedFile::fake()->create($name, $kilobytes, 'application/pdf');
    }

    /**
     * TC-B-01: Creación de bodega con datos válidos (convertido a multipart, HUG-04).
     */
    public function test_landlord_can_create_store_room_with_valid_data()
    {
        $user = User::factory()->create(['role' => 'landlord']);
        $landlord = Landlords::factory()->create([
            'user_id' => $user->id,
        ]);

        $response = $this->actingAs($user, 'sanctum')
            ->post('/api/storeRooms', $this->validPayload([
                'landlord_id' => $landlord->id,
                'publication_status' => 'pending',
            ]));

        $response->assertStatus(201);
        $response->assertJsonPath('item.publication_status', 'pending');

        $this->assertDatabaseHas('storeRooms', [
            'title' => 'Bodega Central Norte',
            'landlord_id' => $landlord->id,
        ]);
    }

    /**
     * TC-B-03: Validación de tamaño (size) debe ser numérico (convertido a multipart, HUG-04).
     */
    public function test_create_store_room_fails_if_size_is_not_numeric()
    {
        /** @var \App\Models\User $user */
        $user = User::factory()->create(['role' => 'landlord']);

        $landlord = Landlords::create(['user_id' => $user->id]);

        $response = $this->actingAs($user, 'sanctum')->post('/api/storeRooms', $this->validPayload([
            'landlord_id' => $landlord->id,
            'size' => 'un-texto-invalido',
        ]));

        $response->assertStatus(400);
        $response->assertJsonValidationErrors(['size']);
    }

    /**
     * TC-B-04: Seguridad - No se puede crear sin estar autenticado
     */
    public function test_cannot_create_store_room_without_authentication()
    {
        $response = $this->postJson('/api/storeRooms', [
            'title' => 'Intento fallido',
        ]);

        $response->assertStatus(401);
    }

    public function test_tenant_cannot_create_store_room()
    {
        $user = User::factory()->create(['role' => 'tenant']);

        $response = $this->actingAs($user, 'sanctum')->post('/api/storeRooms', $this->validPayload());

        $response->assertStatus(403);
        $response->assertJson(['message' => 'No autorizado']);
        $this->assertDatabaseCount('storeRooms', 0);
    }

    public function test_admin_cannot_create_store_room()
    {
        $user = User::factory()->create(['role' => 'admin']);

        $response = $this->actingAs($user, 'sanctum')->post('/api/storeRooms', $this->validPayload());

        $response->assertStatus(403);
        $response->assertJson(['message' => 'No autorizado']);
        $this->assertDatabaseCount('storeRooms', 0);
    }

    public function test_landlord_role_without_landlords_row_is_rejected()
    {
        $user = User::factory()->create(['role' => 'landlord']);

        $response = $this->actingAs($user, 'sanctum')->post('/api/storeRooms', $this->validPayload());

        $response->assertStatus(403);
        $response->assertJson([
            'message' => 'No tienes un registro de landlord asociado a tu cuenta',
            'status' => 403,
        ]);
        $this->assertDatabaseCount('storeRooms', 0);
        $this->assertDatabaseCount('notifications', 0);
    }

    public function test_client_supplied_landlord_id_is_ignored()
    {
        $user = User::factory()->create(['role' => 'landlord']);
        $landlord = Landlords::factory()->create(['user_id' => $user->id]);
        $otherLandlord = Landlords::factory()->create();

        $response = $this->actingAs($user, 'sanctum')->post('/api/storeRooms', $this->validPayload([
            'landlord_id' => $otherLandlord->id,
        ]));

        $response->assertStatus(201);
        $this->assertDatabaseHas('storeRooms', [
            'id' => $response->json('item.id'),
            'landlord_id' => $landlord->id,
        ]);
    }

    public function test_client_supplied_publication_status_is_ignored()
    {
        $user = User::factory()->create(['role' => 'landlord']);
        $landlord = Landlords::factory()->create(['user_id' => $user->id]);

        $response = $this->actingAs($user, 'sanctum')->post('/api/storeRooms', $this->validPayload([
            'publication_status' => 'approved',
        ]));

        $response->assertStatus(201);
        $this->assertDatabaseHas('storeRooms', [
            'id' => $response->json('item.id'),
            'publication_status' => 'pending',
        ]);
    }

    public function test_invalid_nested_price_returns_400_with_no_orphaned_data()
    {
        $user = User::factory()->create(['role' => 'landlord']);
        Landlords::factory()->create(['user_id' => $user->id]);

        $response = $this->actingAs($user, 'sanctum')->post('/api/storeRooms', $this->validPayload([
            'storePrices' => [
                ['mode' => 'month', 'price' => 0, 'disponibility' => 1],
            ],
        ]));

        $response->assertStatus(400);
        $response->assertJsonValidationErrors(['storePrices.0.price']);
        $this->assertDatabaseCount('storeRooms', 0);
    }

    public function test_store_photos_in_registration_body_are_ignored()
    {
        $user = User::factory()->create(['role' => 'landlord']);
        Landlords::factory()->create(['user_id' => $user->id]);

        $response = $this->actingAs($user, 'sanctum')->post('/api/storeRooms', $this->validPayload([
            'storePhotos' => [
                ['photo_url' => 'not-a-real-upload.jpg'],
            ],
        ]));

        $response->assertStatus(201);
        $this->assertSame(0, StorePhoto::count());
    }

    public function test_permit_missing_returns_400_with_exact_message()
    {
        $user = User::factory()->create(['role' => 'landlord']);
        Landlords::factory()->create(['user_id' => $user->id]);

        $payload = $this->validPayload();
        unset($payload['firefighter_permit']);

        $response = $this->actingAs($user, 'sanctum')->post('/api/storeRooms', $payload);

        $response->assertStatus(400);
        $response->assertJsonPath(
            'errors.firefighter_permit.0',
            'Debe adjuntar el permiso de bomberos vigente para continuar.'
        );
        $this->assertDatabaseCount('storeRooms', 0);
        $this->assertDatabaseCount('notifications', 0);
    }

    public function test_missing_cancellation_policy_tier_returns_400()
    {
        $user = User::factory()->create(['role' => 'landlord']);
        Landlords::factory()->create(['user_id' => $user->id]);

        $payload = $this->validPayload();
        unset($payload['cancellation_policy_tier']);

        $response = $this->actingAs($user, 'sanctum')->post('/api/storeRooms', $payload);

        $response->assertStatus(400);
        $response->assertJsonValidationErrors(['cancellation_policy_tier']);
        $this->assertDatabaseCount('storeRooms', 0);
    }

    public function test_permit_with_wrong_mime_type_returns_400()
    {
        $user = User::factory()->create(['role' => 'landlord']);
        Landlords::factory()->create(['user_id' => $user->id]);

        $response = $this->actingAs($user, 'sanctum')->post('/api/storeRooms', $this->validPayload([
            'firefighter_permit' => UploadedFile::fake()->create('permiso.exe', 100, 'application/octet-stream'),
        ]));

        $response->assertStatus(400);
        $response->assertJsonValidationErrors(['firefighter_permit']);
        $this->assertDatabaseCount('storeRooms', 0);
        Storage::disk('private')->assertDirectoryEmpty('firefighter_permits');
    }

    public function test_permit_oversized_returns_400()
    {
        $user = User::factory()->create(['role' => 'landlord']);
        Landlords::factory()->create(['user_id' => $user->id]);

        $response = $this->actingAs($user, 'sanctum')->post('/api/storeRooms', $this->validPayload([
            'firefighter_permit' => UploadedFile::fake()->create('permiso.pdf', 6000, 'application/pdf'),
        ]));

        $response->assertStatus(400);
        $response->assertJsonValidationErrors(['firefighter_permit']);
        $this->assertDatabaseCount('storeRooms', 0);
        Storage::disk('private')->assertDirectoryEmpty('firefighter_permits');
    }

    public function test_valid_permit_end_to_end_and_bracket_notation_prices()
    {
        $user = User::factory()->create(['role' => 'landlord']);
        Landlords::factory()->create(['user_id' => $user->id]);

        $response = $this->actingAs($user, 'sanctum')->post('/api/storeRooms', $this->validPayload([
            'storePrices' => [
                ['mode' => 'month', 'price' => 150, 'disponibility' => 'true'],
            ],
        ]));

        $response->assertStatus(201);

        $permitPath = $response->json('item.firefighter_permit_path');
        $this->assertNotNull($permitPath);
        $this->assertStringStartsWith('firefighter_permits/', $permitPath);
        Storage::disk('private')->assertExists($permitPath);

        $this->assertDatabaseHas('store_prices', [
            'store_room_id' => $response->json('item.id'),
            'mode' => 'month',
            'price' => 150,
        ]);
    }

    public function test_response_contains_item_id_for_photo_upload_chaining()
    {
        $user = User::factory()->create(['role' => 'landlord']);
        Landlords::factory()->create(['user_id' => $user->id]);

        $response = $this->actingAs($user, 'sanctum')->post('/api/storeRooms', $this->validPayload());

        $response->assertStatus(201);
        $this->assertIsInt($response->json('item.id'));
    }

    public function test_successful_registration_notifies_every_admin()
    {
        $admins = User::factory()->count(2)->create(['role' => 'admin']);
        $user = User::factory()->create(['role' => 'landlord']);
        Landlords::factory()->create(['user_id' => $user->id]);

        $response = $this->actingAs($user, 'sanctum')->post('/api/storeRooms', $this->validPayload());

        $response->assertStatus(201);
        foreach ($admins as $admin) {
            $this->assertDatabaseHas('notifications', [
                'receiver_id' => $admin->id,
                'type' => 'store_created',
            ]);
        }
    }
}
