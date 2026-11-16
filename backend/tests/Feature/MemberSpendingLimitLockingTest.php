<?php

namespace Tests\Feature;

use App\Exceptions\MonthlyLimitExceededException;
use App\Models\Organization;
use App\Models\Reservations;
use App\Models\Tenants;
use App\Models\User;
use App\Services\SpendingLimitService;
use App\Services\WalletService;
use Illuminate\Database\Connection;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Testing\DatabaseTruncation;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

/**
 * member-spending-limit ML-11: proves the guard reads the member's spend under
 * the organization row lock and sees what the previous lock holder committed.
 * SQLite ignores FOR UPDATE, so this is PostgreSQL only: on SQLite every test
 * is skipped before the database is touched, and the suite does NOT prove it.
 *
 * Same harness as OrganizationWalletLockingTest: a second connection plays the
 * competing request with a short `lock_timeout`, and the class truncates
 * instead of using RefreshDatabase because the lock holder must COMMIT.
 */
class MemberSpendingLimitLockingTest extends TestCase
{
    use DatabaseTruncation;

    private const COMPETITOR = 'limit_competitor';

    private const LOCK_NOT_AVAILABLE = '55P03';

    private bool $competitorOpened = false;

    private string $defaultConnection;

    protected function beforeTruncatingDatabase(): void
    {
        if (DB::connection()->getDriverName() !== 'pgsql') {
            $this->markTestSkipped('Requires PostgreSQL: SQLite ignores FOR UPDATE row locks.');
        }
    }

    protected function setUp(): void
    {
        parent::setUp();

        $this->defaultConnection = config('database.default');
    }

    protected function tearDown(): void
    {
        if ($this->app && DB::connection()->getDriverName() === 'pgsql') {
            DB::setDefaultConnection($this->defaultConnection);

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
        config(['database.connections.'.self::COMPETITOR => config('database.connections.'.$this->defaultConnection)]);
        $this->competitorOpened = true;

        $connection = DB::connection(self::COMPETITOR);
        $connection->statement("SET lock_timeout = '300ms'");

        return $connection;
    }

    /**
     * Runs the callback with the competitor as the default connection, so the
     * services and Eloquent models under test use the second session.
     */
    private function asCompetitor(callable $callback): mixed
    {
        $this->competitor();
        DB::setDefaultConnection(self::COMPETITOR);

        try {
            return $callback();
        } finally {
            DB::setDefaultConnection($this->defaultConnection);
        }
    }

    /**
     * @return array{Organization, User}
     */
    private function limitedMember(string $limit): array
    {
        $organization = Organization::factory()->withBalance('5000.00')->create();
        $user = User::factory()->create(['role' => 'tenant']);
        $organization->users()->attach($user->id, ['role' => 'member', 'monthly_limit' => $limit]);

        return [$organization, $user];
    }

    private function reservationFor(Organization $organization, User $user, string $start): Reservations
    {
        $tenant = Tenants::firstOrCreate(['user_id' => $user->id], ['search_preference' => 'price']);

        return Reservations::factory()->forOrganization($organization)->create([
            'tenant_id' => $tenant->id,
            'start_date' => $start,
            'end_date' => '2027-01-31',
        ]);
    }

    public function test_the_guard_runs_under_the_lock_and_the_next_holder_sees_the_committed_spend()
    {
        [$organization, $user] = $this->limitedMember('1000.00');
        $first = $this->reservationFor($organization, $user, '2026-11-10');
        $month = $first->start_date;

        DB::beginTransaction();
        $locked = app(WalletService::class)->lockOrganization($organization->id);

        try {
            $this->competitor()->transaction(
                fn ($connection) => $connection->table('organizations')->where('id', $organization->id)->lockForUpdate()->first()
            );
            $this->fail('The competing FOR UPDATE was not blocked by the organization lock.');
        } catch (QueryException $e) {
            $this->assertStringContainsString(self::LOCK_NOT_AVAILABLE, $e->getMessage());
        }

        app(SpendingLimitService::class)->assertMaySpend($locked, $user->id, $first, '600.00');
        app(WalletService::class)->debitForReservation($locked, $first, '600.00', $user->id);
        DB::commit();

        $seen = $this->asCompetitor(function () use ($organization, $user, $month) {
            return DB::transaction(function () use ($organization, $user, $month) {
                app(WalletService::class)->lockOrganization($organization->id);

                return app(SpendingLimitService::class)
                    ->spentCentsByUser($organization->id, \Carbon\Carbon::parse($month), $user->id)[$user->id] ?? 0;
            });
        });

        $this->assertSame(60000, $seen);
    }

    // ML-S42
    public function test_two_bookings_that_together_exceed_the_limit_cannot_both_pass()
    {
        [$organization, $user] = $this->limitedMember('1000.00');
        $first = $this->reservationFor($organization, $user, '2026-11-10');
        $second = $this->reservationFor($organization, $user, '2026-11-20');

        DB::beginTransaction();
        $locked = app(WalletService::class)->lockOrganization($organization->id);
        app(SpendingLimitService::class)->assertMaySpend($locked, $user->id, $first, '600.00');
        app(WalletService::class)->debitForReservation($locked, $first, '600.00', $user->id);
        DB::commit();

        $this->expectException(MonthlyLimitExceededException::class);

        $this->asCompetitor(function () use ($organization, $user, $second) {
            DB::transaction(function () use ($organization, $user, $second) {
                $locked = app(WalletService::class)->lockOrganization($organization->id);
                app(SpendingLimitService::class)->assertMaySpend($locked, $user->id, $second, '600.00');
            });
        });
    }
}
