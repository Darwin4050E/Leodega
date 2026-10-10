<?php

namespace Tests\Unit;

use App\Enums\WalletMovementType;
use App\Models\Organization;
use App\Models\OrganizationWalletMovement;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use LogicException;
use Tests\TestCase;

/**
 * org-wallet OW-2: the movement ledger is append-only inside the app, and the
 * cached balance on Organization is cast to 2 decimals and never mass-assigned.
 */
class OrganizationWalletMovementTest extends TestCase
{
    use RefreshDatabase;

    // -- append-only (OW-2) --

    public function test_updating_a_movement_throws_and_leaves_the_row_unchanged()
    {
        $movement = OrganizationWalletMovement::factory()->create(['amount' => '100.00']);

        try {
            $movement->update(['amount' => '5.00']);
            $this->fail('Updating a movement must throw.');
        } catch (LogicException) {
            $this->assertSame('100.00', $movement->fresh()->amount);
        }
    }

    public function test_deleting_a_movement_throws_and_keeps_the_row()
    {
        $movement = OrganizationWalletMovement::factory()->create();

        try {
            $movement->delete();
            $this->fail('Deleting a movement must throw.');
        } catch (LogicException) {
            $this->assertDatabaseHas('organization_wallet_movements', ['id' => $movement->id]);
        }
    }

    public function test_a_movement_has_a_creation_time_but_no_update_time()
    {
        $movement = OrganizationWalletMovement::factory()->create();

        $this->assertNull($movement->getUpdatedAtColumn());
        $this->assertNotNull($movement->fresh()->created_at);
    }

    public function test_a_movement_casts_its_type_and_its_amounts()
    {
        $movement = OrganizationWalletMovement::factory()->create([
            'type' => WalletMovementType::Reserva,
            'amount' => '-40.00',
            'balance_after' => '60.00',
        ])->fresh();

        $this->assertSame(WalletMovementType::Reserva, $movement->type);
        $this->assertSame('-40.00', $movement->amount);
        $this->assertSame('60.00', $movement->balance_after);
    }

    public function test_an_organization_exposes_its_movements()
    {
        $organization = Organization::factory()->create();
        OrganizationWalletMovement::factory()->count(2)->create(['organization_id' => $organization->id]);
        OrganizationWalletMovement::factory()->create();

        $this->assertCount(2, $organization->walletMovements);
    }

    // -- Organization.wallet_balance --

    public function test_wallet_balance_is_cast_to_a_two_decimal_string()
    {
        $organization = Organization::factory()->create();
        DB::table('organizations')->where('id', $organization->id)->update(['wallet_balance' => 80.5]);

        $this->assertSame('80.50', $organization->fresh()->wallet_balance);
    }

    public function test_wallet_balance_is_not_mass_assignable()
    {
        $organization = Organization::create([
            'name' => 'Andina', 'ruc' => '1790011111001', 'email' => 'a@andina.ec',
            'wallet_balance' => '500.00',
        ]);

        $this->assertSame('0.00', $organization->fresh()->wallet_balance);
    }

    // -- OrganizationFactory::withBalance --

    public function test_with_balance_funds_the_organization_without_writing_the_ledger()
    {
        $organization = Organization::factory()->withBalance('80.50')->create();

        $this->assertSame('80.50', $organization->wallet_balance);
        $this->assertSame('80.50', $organization->fresh()->wallet_balance);
        $this->assertDatabaseCount('organization_wallet_movements', 0);
    }

    public function test_a_default_factory_organization_starts_at_zero()
    {
        $this->assertSame('0.00', Organization::factory()->create()->wallet_balance);
    }
}
