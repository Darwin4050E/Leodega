<?php

namespace Tests\Feature;

use App\Models\Organization;
use App\Models\Payments;
use App\Models\Reservations;
use App\Models\User;
use Illuminate\Database\QueryException;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

/**
 * org-wallet U1a: schema contract for the wallet balance, the append-only
 * movement ledger and the `wallet` payment method (OW-1, OW-16). Tests that
 * need PostgreSQL behavior (CHECK constraint, numeric scale) skip on SQLite,
 * which has neither; row locking lives in OrganizationWalletLockingTest.
 */
class OrganizationWalletSchemaTest extends TestCase
{
    use RefreshDatabase;

    private function insertMovement(array $overrides = []): void
    {
        $overrides['organization_id'] ??= Organization::factory()->create()->id;

        DB::table('organization_wallet_movements')->insert(array_merge([
            'user_id' => null,
            'reservation_id' => null,
            'type' => 'recarga',
            'amount' => '100.00',
            'balance_after' => '100.00',
            'created_at' => now(),
        ], $overrides));
    }

    private function skipUnlessPgsql(): void
    {
        if (DB::connection()->getDriverName() !== 'pgsql') {
            $this->markTestSkipped('Requires PostgreSQL: SQLite has no ADD CONSTRAINT and ignores decimal scale.');
        }
    }

    // -- organizations.wallet_balance (OW-1) --

    public function test_wallet_balance_defaults_to_zero_for_a_row_that_does_not_set_it()
    {
        DB::table('organizations')->insert([
            'name' => 'Andina', 'ruc' => '1790011111001', 'email' => 'a@andina.ec',
            'created_at' => now(), 'updated_at' => now(),
        ]);

        $this->assertEquals(0, DB::table('organizations')->value('wallet_balance'));
    }

    public function test_wallet_balance_is_not_nullable()
    {
        $column = collect(Schema::getColumns('organizations'))->firstWhere('name', 'wallet_balance');
        $organization = Organization::factory()->create();

        $this->assertFalse($column['nullable']);

        $this->expectException(QueryException::class);
        DB::table('organizations')->where('id', $organization->id)->update(['wallet_balance' => null]);
    }

    // -- organization_wallet_movements (OW-2, OW-16) --

    public function test_movements_table_has_the_expected_columns()
    {
        $this->assertTrue(Schema::hasTable('organization_wallet_movements'));
        $this->assertTrue(Schema::hasColumns('organization_wallet_movements', [
            'id', 'organization_id', 'user_id', 'reservation_id', 'type', 'amount', 'balance_after', 'created_at',
        ]));
        $this->assertFalse(Schema::hasColumn('organization_wallet_movements', 'updated_at'));
    }

    public function test_the_same_reservation_and_type_are_rejected_but_another_type_is_accepted()
    {
        $organization = Organization::factory()->create();
        $reservation = Reservations::factory()->forOrganization($organization)->create();
        $this->insertMovement([
            'organization_id' => $organization->id, 'reservation_id' => $reservation->id,
            'type' => 'reserva', 'amount' => '-40.00',
        ]);
        $this->insertMovement([
            'organization_id' => $organization->id, 'reservation_id' => $reservation->id,
            'type' => 'reembolso', 'amount' => '20.00',
        ]);

        $this->assertDatabaseCount('organization_wallet_movements', 2);

        $this->expectException(UniqueConstraintViolationException::class);
        $this->insertMovement([
            'organization_id' => $organization->id, 'reservation_id' => $reservation->id,
            'type' => 'reserva', 'amount' => '-10.00',
        ]);
    }

    public function test_several_recargas_without_a_reservation_are_accepted()
    {
        $organization = Organization::factory()->create();

        $this->insertMovement(['organization_id' => $organization->id]);
        $this->insertMovement(['organization_id' => $organization->id]);
        $this->insertMovement(['organization_id' => $organization->id]);

        $this->assertDatabaseCount('organization_wallet_movements', 3);
    }

    public function test_deleting_the_actor_or_the_reservation_keeps_the_ledger_row_with_a_null_reference()
    {
        $organization = Organization::factory()->create();
        $actor = User::factory()->create();
        $reservation = Reservations::factory()->forOrganization($organization)->create();
        $this->insertMovement([
            'organization_id' => $organization->id, 'user_id' => $actor->id,
            'reservation_id' => $reservation->id, 'type' => 'reserva', 'amount' => '-40.00',
        ]);

        $actor->delete();
        $reservation->delete();

        $row = DB::table('organization_wallet_movements')->first();
        $this->assertNull($row->user_id);
        $this->assertNull($row->reservation_id);
        $this->assertSame($organization->id, $row->organization_id);
    }

    public function test_an_organization_with_movements_cannot_be_deleted()
    {
        $organization = Organization::factory()->create();
        $this->insertMovement(['organization_id' => $organization->id]);

        $this->expectException(QueryException::class);
        $organization->delete();
    }

    // -- payments.payment_method (OW-16) --

    public function test_payments_accept_the_wallet_method_and_reject_an_unknown_one()
    {
        $reservation = Reservations::factory()->create();

        Payments::factory()->create(['reservation_id' => $reservation->id, 'payment_method' => 'wallet']);
        $this->assertDatabaseHas('payments', ['reservation_id' => $reservation->id, 'payment_method' => 'wallet']);

        $this->expectException(QueryException::class);
        Payments::factory()->create(['reservation_id' => $reservation->id, 'payment_method' => 'paypal']);
    }

    // -- rollback (OW-S51) --

    public function test_rolling_back_the_three_migrations_keeps_organizations_and_reservations()
    {
        $organization = Organization::factory()->create();
        $reservation = Reservations::factory()->forOrganization($organization)->create();

        $this->artisan('migrate:rollback', ['--step' => 3])->assertExitCode(0);

        $this->assertFalse(Schema::hasTable('organization_wallet_movements'));
        $this->assertFalse(Schema::hasColumn('organizations', 'wallet_balance'));
        $this->assertDatabaseHas('organizations', ['id' => $organization->id]);
        $this->assertDatabaseHas('reservations', ['id' => $reservation->id, 'organization_id' => $organization->id]);

        $this->expectException(QueryException::class);
        Payments::factory()->create(['reservation_id' => $reservation->id, 'payment_method' => 'wallet']);
    }

    // -- PostgreSQL only (OW-S23, OW-3) --

    public function test_pgsql_rejects_a_negative_balance()
    {
        $this->skipUnlessPgsql();
        $organization = Organization::factory()->create();

        $this->expectException(QueryException::class);
        DB::table('organizations')->where('id', $organization->id)->update(['wallet_balance' => '-0.01']);
    }

    public function test_pgsql_accepts_a_zero_balance()
    {
        $this->skipUnlessPgsql();
        $organization = Organization::factory()->create();

        DB::table('organizations')->where('id', $organization->id)->update(['wallet_balance' => '0.00']);

        $this->assertEquals(0, DB::table('organizations')->where('id', $organization->id)->value('wallet_balance'));
    }

    public function test_pgsql_stores_a_three_decimal_raw_value_as_numeric_10_2()
    {
        $this->skipUnlessPgsql();
        $organization = Organization::factory()->create();

        DB::table('organizations')->where('id', $organization->id)->update(['wallet_balance' => '10.005']);

        $this->assertSame('10.01', DB::table('organizations')->where('id', $organization->id)->value('wallet_balance'));
    }
}
