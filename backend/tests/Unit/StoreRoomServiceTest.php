<?php

namespace Tests\Unit;

use App\Models\Landlords;
use App\Models\StoreRooms;
use App\Models\User;
use App\Services\StoreRoomService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;
use Tests\TestCase;

class StoreRoomServiceTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        Storage::fake('public');
    }

    private function validData(): array
    {
        return [
            'room_type' => 'bodega',
            'storage_type' => 'completa',
            'direction' => 'Av. Carlos Julio Arosemena',
            'city' => 'Guayaquil',
            'size' => 45.5,
            'title' => 'Bodega Central Norte',
            'description' => 'Espacio amplio',
            'security' => 'Alta',
        ];
    }

    private function fakePermit(): UploadedFile
    {
        return UploadedFile::fake()->create('permiso.pdf', 100, 'application/pdf');
    }

    public function test_register_forces_pending_even_when_data_carries_approved()
    {
        $landlord = Landlords::factory()->create();
        $data = $this->validData() + ['publication_status' => 'approved'];

        $room = (new StoreRoomService)->register($landlord, $data, null, $this->fakePermit(), $landlord->user_id);

        $this->assertSame('pending', $room->fresh()->publication_status);
    }

    public function test_register_sets_landlord_id_from_the_passed_landlord()
    {
        $landlord = Landlords::factory()->create();

        $room = (new StoreRoomService)->register($landlord, $this->validData(), null, $this->fakePermit(), $landlord->user_id);

        $this->assertSame($landlord->id, $room->fresh()->landlord_id);
    }

    public function test_register_with_valid_store_prices_creates_the_children()
    {
        $landlord = Landlords::factory()->create();
        $prices = [
            ['mode' => 'month', 'price' => 120.5, 'disponibility' => 1],
        ];

        $room = (new StoreRoomService)->register($landlord, $this->validData(), $prices, $this->fakePermit(), $landlord->user_id);

        $this->assertDatabaseHas('store_prices', [
            'store_room_id' => $room->id,
            'mode' => 'month',
            'price' => 120.5,
        ]);
    }

    public function test_register_with_invalid_price_throws_validation_exception_and_creates_no_room()
    {
        $landlord = Landlords::factory()->create();
        $prices = [
            ['mode' => 'month', 'price' => 0, 'disponibility' => 1], // below min:0.5
        ];

        $this->expectException(ValidationException::class);

        try {
            (new StoreRoomService)->register($landlord, $this->validData(), $prices, $this->fakePermit(), $landlord->user_id);
        } finally {
            $this->assertDatabaseCount('storeRooms', 0);
        }
    }

    public function test_register_with_invalid_price_writes_no_orphaned_permit_file()
    {
        $landlord = Landlords::factory()->create();
        $prices = [
            ['mode' => 'month', 'price' => 0, 'disponibility' => 1],
        ];

        try {
            (new StoreRoomService)->register($landlord, $this->validData(), $prices, $this->fakePermit(), $landlord->user_id);
        } catch (ValidationException $e) {
            // expected — the point of this test is what happens on disk
        }

        Storage::disk('public')->assertDirectoryEmpty('firefighter_permits');
    }

    public function test_register_persists_the_permit_file()
    {
        $landlord = Landlords::factory()->create();

        $room = (new StoreRoomService)->register($landlord, $this->validData(), null, $this->fakePermit(), $landlord->user_id);

        $this->assertNotNull($room->firefighter_permit_path);
        Storage::disk('public')->assertExists($room->firefighter_permit_path);
    }

    public function test_register_deletes_the_permit_when_the_transaction_fails()
    {
        // Un landlord con un id que no existe en la tabla `landlords` fuerza
        // una violación de foreign key dentro de la transacción de
        // StoreRooms::create — esto ejercita la ruta de borrado
        // compensatorio (D11) sin tocar la lógica de negocio del servicio.
        $landlord = Landlords::factory()->make();
        $landlord->id = 999999;

        $capturedPath = null;

        try {
            (new StoreRoomService)->register($landlord, $this->validData(), null, $this->fakePermit(), 1);
            $this->fail('Expected a database exception to be thrown.');
        } catch (\Throwable $e) {
            $files = Storage::disk('public')->allFiles('firefighter_permits');
            $capturedPath = $files[0] ?? null;
        }

        $this->assertDatabaseCount('storeRooms', 0);
        $this->assertNull($capturedPath, 'The permit file must not remain on disk after a failed transaction.');
    }

    public function test_register_coerces_disponibility_string_true_before_validating()
    {
        $landlord = Landlords::factory()->create();
        $prices = [
            ['mode' => 'month', 'price' => 100, 'disponibility' => 'true'],
        ];

        $room = (new StoreRoomService)->register($landlord, $this->validData(), $prices, $this->fakePermit(), $landlord->user_id);

        $this->assertDatabaseHas('store_prices', [
            'store_room_id' => $room->id,
            'disponibility' => 1,
        ]);
    }

    public function test_register_with_store_prices_omitted_creates_one_room_and_no_prices()
    {
        $landlord = Landlords::factory()->create();

        $room = (new StoreRoomService)->register($landlord, $this->validData(), null, $this->fakePermit(), $landlord->user_id);

        $this->assertDatabaseCount('storeRooms', 1);
        $this->assertDatabaseCount('store_prices', 0);
        $this->assertCount(0, $room->storePrices);
    }

    public function test_register_notifies_every_admin()
    {
        $admins = User::factory()->count(2)->create(['role' => 'admin']);
        $landlord = Landlords::factory()->create();

        $room = (new StoreRoomService)->register($landlord, $this->validData(), null, $this->fakePermit(), $landlord->user_id);

        foreach ($admins as $admin) {
            $this->assertDatabaseHas('notifications', [
                'receiver_id' => $admin->id,
                'type' => 'store_created',
            ]);
        }
        $this->assertDatabaseCount('notifications', 2);
        unset($room);
    }

    public function test_register_persists_room_even_if_notification_dispatch_throws()
    {
        User::factory()->create(['role' => 'admin']);
        $landlord = Landlords::factory()->create();

        // `notifications.sender_id` has a real FK to `user`; an acting user
        // id that does not exist forces NotificationService::send to throw
        // for every admin, exercising the post-commit catch without mocking
        // the notification service (D5).
        $room = (new StoreRoomService)->register($landlord, $this->validData(), null, $this->fakePermit(), 999999);

        $this->assertDatabaseHas('storeRooms', ['id' => $room->id]);
        Storage::disk('public')->assertExists($room->firefighter_permit_path);
        $this->assertDatabaseCount('notifications', 0);
    }
}
