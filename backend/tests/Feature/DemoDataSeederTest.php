<?php

namespace Tests\Feature;

use App\Models\StoreRooms;
use App\Models\User;
use Database\Seeders\DemoDataSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class DemoDataSeederTest extends TestCase
{
    use RefreshDatabase;

    public function test_it_creates_the_full_demo_dataset()
    {
        $this->seed(DemoDataSeeder::class);

        $this->assertDatabaseCount('user', 4);
        $this->assertDatabaseCount('landlords', 2);
        $this->assertDatabaseCount('tenants', 2);
        $this->assertDatabaseCount('storeRooms', 6);
        $this->assertDatabaseCount('store_prices', 6);
        $this->assertDatabaseCount('reservations', 2);

        $this->assertSame(3, StoreRooms::where('publication_status', 'approved')->count());
        $this->assertSame(2, StoreRooms::where('publication_status', 'pending')->count());
        $this->assertSame(1, StoreRooms::where('publication_status', 'rejected')->count());
    }

    public function test_the_seeded_gestor_credentials_work()
    {
        $this->seed(DemoDataSeeder::class);

        $gestor = User::where('email', 'gestor@leodega.com')->first();

        $this->assertNotNull($gestor);
        $this->assertSame('landlord', $gestor->role);
        $this->assertTrue(Hash::check('gestor123', $gestor->password));
        $this->assertNotNull($gestor->landlord);
    }

    public function test_it_is_idempotent()
    {
        $this->seed(DemoDataSeeder::class);
        $this->seed(DemoDataSeeder::class);

        $this->assertDatabaseCount('user', 4);
        $this->assertDatabaseCount('storeRooms', 6);
        $this->assertDatabaseCount('store_prices', 6);
        $this->assertDatabaseCount('reservations', 2);
    }
}
