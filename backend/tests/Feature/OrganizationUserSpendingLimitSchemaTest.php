<?php

namespace Tests\Feature;

use App\Models\Organization;
use App\Models\Reservations;
use App\Models\User;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

/**
 * member-spending-limit U1a: schema contract for `organization_user.monthly_limit`
 * (ML-1, ML-16). The CHECK constraint exists only on PostgreSQL, so its test
 * skips on SQLite.
 */
class OrganizationUserSpendingLimitSchemaTest extends TestCase
{
    use RefreshDatabase;

    private function tenant(): User
    {
        return User::factory()->create(['role' => 'tenant']);
    }

    private function limitOf(Organization $organization, User $user): mixed
    {
        return DB::table('organization_user')
            ->where('organization_id', $organization->id)
            ->where('user_id', $user->id)
            ->value('monthly_limit');
    }

    public function test_the_column_is_nullable_and_defaults_to_null()
    {
        $column = collect(Schema::getColumns('organization_user'))->firstWhere('name', 'monthly_limit');

        $this->assertNotNull($column);
        $this->assertTrue($column['nullable']);
        $this->assertNull($column['default']);
    }

    public function test_the_column_accepts_a_two_decimal_amount()
    {
        $user = $this->tenant();
        $organization = Organization::factory()->create();
        $organization->users()->attach($user->id, ['role' => 'member', 'monthly_limit' => '250.50']);

        $this->assertEquals(250.50, $this->limitOf($organization, $user));
    }

    // ML-S1
    public function test_a_member_attached_without_a_limit_has_a_null_limit()
    {
        $user = $this->tenant();
        $organization = Organization::factory()->create();

        $organization->users()->attach($user->id, ['role' => 'member']);

        $this->assertNull($this->limitOf($organization, $user));
    }

    // ML-S2
    public function test_the_creator_of_an_organization_starts_unlimited()
    {
        $creator = $this->tenant();

        $this->actingAs($creator, 'sanctum')->post('/api/organizations', [
            'name' => 'Importadora Andina S.A.',
            'ruc' => '1790012345001',
            'email' => 'contacto@andina.ec',
        ], ['Accept' => 'application/json'])->assertStatus(201);

        $organization = Organization::sole();
        $this->assertNull($this->limitOf($organization, $creator));
    }

    // ML-S3
    public function test_a_limit_is_individual_per_member_and_per_organization()
    {
        $a = $this->tenant();
        $b = $this->tenant();
        $org1 = Organization::factory()->create();
        $org2 = Organization::factory()->create();
        $org1->users()->attach($a->id, ['role' => 'member', 'monthly_limit' => '500.00']);
        $org1->users()->attach($b->id, ['role' => 'member']);
        $org2->users()->attach($a->id, ['role' => 'member']);

        $this->assertEquals(500, $this->limitOf($org1, $a));
        $this->assertNull($this->limitOf($org1, $b));
        $this->assertNull($this->limitOf($org2, $a));
    }

    // ML-S4
    public function test_rolling_back_drops_the_column_and_keeps_memberships_and_reservations()
    {
        $user = $this->tenant();
        $organization = Organization::factory()->create();
        $organization->users()->attach($user->id, ['role' => 'member', 'monthly_limit' => '500.00']);
        $reservation = Reservations::factory()->forOrganization($organization)->create();

        $this->artisan('migrate:rollback', ['--step' => 1])->assertExitCode(0);

        $this->assertFalse(Schema::hasColumn('organization_user', 'monthly_limit'));
        $this->assertDatabaseHas('organizations', ['id' => $organization->id]);
        $this->assertDatabaseHas('organization_user', ['organization_id' => $organization->id, 'user_id' => $user->id]);
        $this->assertDatabaseHas('reservations', ['id' => $reservation->id]);
    }

    // ML-S63
    public function test_a_membership_removed_and_attached_again_starts_unlimited()
    {
        $user = $this->tenant();
        $organization = Organization::factory()->create();
        $organization->users()->attach($user->id, ['role' => 'member', 'monthly_limit' => '500.00']);

        $organization->users()->detach($user->id);
        $organization->users()->attach($user->id, ['role' => 'member']);

        $this->assertNull($this->limitOf($organization, $user));
    }

    // -- PostgreSQL only (ML-1): not executable on SQLite --

    public function test_check_constraint_rejects_out_of_range()
    {
        if (DB::connection()->getDriverName() !== 'pgsql') {
            $this->markTestSkipped('Requires PostgreSQL: SQLite has no ADD CONSTRAINT.');
        }

        $organization = Organization::factory()->create();

        foreach (['0', '-1', '1000000.00'] as $invalid) {
            $user = $this->tenant();
            try {
                // The nested transaction is a savepoint: PostgreSQL aborts the
                // whole transaction on a failed statement unless it is rolled back to one.
                DB::transaction(fn () => $organization->users()->attach($user->id, ['role' => 'member', 'monthly_limit' => $invalid]));
                $this->fail("The database accepted monthly_limit {$invalid}.");
            } catch (QueryException $e) {
                $this->assertSame('23514', $e->getCode());
            }
        }

        foreach ([null, '999999.99'] as $valid) {
            $user = $this->tenant();
            $organization->users()->attach($user->id, ['role' => 'member', 'monthly_limit' => $valid]);
        }

        $this->addToAssertionCount(1);
    }
}
