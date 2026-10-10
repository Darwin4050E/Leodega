<?php

namespace Tests\Feature;

use App\Enums\OrganizationRole;
use App\Enums\WalletMovementType;
use App\Models\Organization;
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

    public function test_it_seeds_a_funded_demo_organization_with_one_recharge()
    {
        $this->seed(DemoDataSeeder::class);

        $organization = Organization::where('name', 'Andina Logistica')->sole();
        $this->assertSame('1790011111001', $organization->ruc);
        $this->assertSame('5000.00', $organization->wallet_balance);
        $this->assertEquals(
            ['cliente@leodega.com' => OrganizationRole::ADMIN->value, 'cliente2@leodega.com' => OrganizationRole::MEMBER->value],
            $organization->users->mapWithKeys(fn ($user) => [$user->email => $user->pivot->role])->all(),
        );

        $movement = $organization->walletMovements()->sole();
        $this->assertSame(WalletMovementType::Recarga, $movement->type);
        $this->assertSame('5000.00', $movement->amount);
        $this->assertSame('5000.00', $movement->balance_after);
        $this->assertSame('cliente@leodega.com', $movement->user->email);
    }

    public function test_reseeding_never_funds_the_demo_organization_twice()
    {
        $this->seed(DemoDataSeeder::class);
        $this->seed(DemoDataSeeder::class);

        $organization = Organization::where('name', 'Andina Logistica')->sole();
        $this->assertSame('5000.00', $organization->wallet_balance);
        $this->assertSame(1, $organization->walletMovements()->count());
        $this->assertDatabaseCount('organizations', 1);
    }

    public function test_an_organization_created_outside_the_seeder_stays_unfunded()
    {
        $this->seed(DemoDataSeeder::class);

        $other = Organization::factory()->create();

        $this->assertSame('0.00', $other->fresh()->wallet_balance);
        $this->assertSame(0, $other->walletMovements()->count());
    }
}
