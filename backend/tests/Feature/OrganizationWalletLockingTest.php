<?php

namespace Tests\Feature;

use App\Models\Organization;
use App\Services\WalletService;
use Illuminate\Database\Connection;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Testing\DatabaseTruncation;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

/**
 * org-wallet OW-6/OW-3: proves WalletService::lockOrganization really takes a
 * row lock, which SQLite cannot show (it ignores FOR UPDATE). PostgreSQL only;
 * on SQLite every test is skipped before the database is touched.
 *
 * A second, dedicated connection plays the competing request. It runs with a
 * short `lock_timeout`, so a blocked `FOR UPDATE` fails fast with SQLSTATE
 * 55P03 (lock_not_available) instead of hanging the suite. The lock holder
 * must have COMMITTED data visible to that second connection, so this class
 * cannot use RefreshDatabase's wrapping transaction: it truncates instead and
 * cleans up after itself so later RefreshDatabase tests start from empty tables.
 */
class OrganizationWalletLockingTest extends TestCase
{
    use DatabaseTruncation;

    private const COMPETITOR = 'wallet_competitor';

    private const LOCK_NOT_AVAILABLE = '55P03';

    private bool $competitorOpened = false;

    protected function beforeTruncatingDatabase(): void
    {
        if (DB::connection()->getDriverName() !== 'pgsql') {
            $this->markTestSkipped('Requires PostgreSQL: SQLite ignores FOR UPDATE row locks.');
        }
    }

    protected function tearDown(): void
    {
        if ($this->app && DB::connection()->getDriverName() === 'pgsql') {
            while (DB::transactionLevel() > 0) {
                DB::rollBack();
            }

            if ($this->competitorOpened) {
                DB::purge(self::COMPETITOR);
            }

            $this->truncateTablesForAllConnections();
        }

        parent::tearDown();
    }

    private function competitor(): Connection
    {
        config(['database.connections.'.self::COMPETITOR => config('database.connections.'.config('database.default'))]);
        $this->competitorOpened = true;

        $connection = DB::connection(self::COMPETITOR);
        $connection->statement("SET lock_timeout = '300ms'");

        return $connection;
    }

    private function lockAsCompetitor(int $organizationId): void
    {
        $this->competitor()->transaction(
            fn ($connection) => $connection->table('organizations')->where('id', $organizationId)->lockForUpdate()->first()
        );
    }

    public function test_the_wallet_lock_blocks_a_competing_connection_until_released()
    {
        $organization = Organization::factory()->create();

        DB::beginTransaction();
        app(WalletService::class)->lockOrganization($organization->id);

        try {
            $this->lockAsCompetitor($organization->id);
            $this->fail('The competing FOR UPDATE was not blocked by the wallet lock.');
        } catch (QueryException $e) {
            $this->assertStringContainsString(self::LOCK_NOT_AVAILABLE, $e->getMessage());
        }

        DB::commit();

        $this->lockAsCompetitor($organization->id);
        $this->addToAssertionCount(1);
    }

    public function test_the_wallet_lock_is_per_organization()
    {
        $locked = Organization::factory()->create();
        $other = Organization::factory()->create();

        DB::beginTransaction();
        app(WalletService::class)->lockOrganization($locked->id);

        $this->lockAsCompetitor($other->id);
        $this->addToAssertionCount(1);

        DB::rollBack();
    }
}
