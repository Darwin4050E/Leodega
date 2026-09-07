<?php

namespace Tests\Unit;

use App\Models\Landlords;
use App\Models\StorePrices;
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

        Storage::fake('private');
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

        Storage::disk('private')->assertDirectoryEmpty('firefighter_permits');
    }

    public function test_register_persists_the_permit_file()
    {
        $landlord = Landlords::factory()->create();

        $room = (new StoreRoomService)->register($landlord, $this->validData(), null, $this->fakePermit(), $landlord->user_id);

        $this->assertNotNull($room->firefighter_permit_path);
        Storage::disk('private')->assertExists($room->firefighter_permit_path);
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
            $files = Storage::disk('private')->allFiles('firefighter_permits');
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
        Storage::disk('private')->assertExists($room->firefighter_permit_path);
        $this->assertDatabaseCount('notifications', 0);
    }

    // --- updateListing (HUG-08) ------------------------------------------------

    public function test_update_listing_updates_only_the_scalar_fields_that_were_sent()
    {
        $room = StoreRooms::factory()->create(['title' => 'Viejo', 'description' => 'Vieja', 'size' => 10]);

        $fresh = (new StoreRoomService)->updateListing($room, ['title' => 'Nuevo', 'size' => 42.5]);

        $this->assertSame('Nuevo', $fresh->title);
        $this->assertEquals(42.5, $fresh->size);
        $this->assertSame('Vieja', $fresh->description);
        $this->assertDatabaseHas('storeRooms', ['id' => $room->id, 'title' => 'Nuevo', 'size' => 42.5]);
    }

    public function test_update_listing_targets_the_month_price_row_and_leaves_the_others()
    {
        $room = StoreRooms::factory()->create();
        $month = StorePrices::factory()->create(['store_room_id' => $room->id, 'mode' => 'month', 'price' => 1000, 'disponibility' => true]);
        $year = StorePrices::factory()->create(['store_room_id' => $room->id, 'mode' => 'year', 'price' => 9000, 'disponibility' => true]);

        (new StoreRoomService)->updateListing($room, ['price' => 1234.5, 'disponibility' => false]);

        // same row, updated in place — never delete + recreate
        $this->assertDatabaseHas('store_prices', ['id' => $month->id, 'price' => 1234.5, 'disponibility' => false]);
        $this->assertDatabaseHas('store_prices', ['id' => $year->id, 'price' => 9000, 'disponibility' => true]);
        $this->assertDatabaseCount('store_prices', 2);
    }

    public function test_update_listing_without_price_keys_does_not_touch_price_rows()
    {
        $room = StoreRooms::factory()->create();
        $month = StorePrices::factory()->create(['store_room_id' => $room->id, 'mode' => 'month', 'price' => 1000]);

        (new StoreRoomService)->updateListing($room, ['description' => 'Solo texto']);

        $this->assertDatabaseHas('store_prices', ['id' => $month->id, 'price' => 1000]);
        $this->assertDatabaseCount('store_prices', 1);
    }

    public function test_update_listing_rolls_back_scalar_changes_when_month_price_row_is_missing()
    {
        $room = StoreRooms::factory()->create(['title' => 'Intacto']);
        StorePrices::factory()->create(['store_room_id' => $room->id, 'mode' => 'day', 'price' => 30]);

        try {
            (new StoreRoomService)->updateListing($room, ['title' => 'Cambiado', 'price' => 500]);
            $this->fail('Expected a ValidationException.');
        } catch (ValidationException $e) {
            $this->assertArrayHasKey('price', $e->errors());
        }

        $this->assertDatabaseHas('storeRooms', ['id' => $room->id, 'title' => 'Intacto']);
        $this->assertDatabaseHas('store_prices', ['store_room_id' => $room->id, 'mode' => 'day', 'price' => 30]);
        $this->assertDatabaseCount('store_prices', 1);
    }

    public function test_update_listing_returns_the_fresh_room_with_prices_loaded()
    {
        $room = StoreRooms::factory()->create();
        StorePrices::factory()->create(['store_room_id' => $room->id, 'mode' => 'month', 'price' => 1000]);

        $fresh = (new StoreRoomService)->updateListing($room, ['price' => 1100]);

        $this->assertTrue($fresh->relationLoaded('storePrices'));
        $this->assertEquals(1100, $fresh->storePrices->firstWhere('mode', 'month')->price);
    }
}
