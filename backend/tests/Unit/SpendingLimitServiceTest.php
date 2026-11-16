<?php

namespace Tests\Unit;

use App\Enums\WalletMovementType;
use App\Exceptions\MonthlyLimitExceededException;
use App\Models\Organization;
use App\Models\OrganizationWalletMovement;
use App\Models\Reservations;
use App\Models\User;
use App\Services\SpendingLimitService;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use LogicException;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

/**
 * member-spending-limit ML-3..ML-6: the guard and the net-spend figure it
 * reads. SQLite ignores row locks, so these tests prove the arithmetic and
 * month rules; the read-after-lock behavior lives in
 * MemberSpendingLimitLockingTest (PostgreSQL only).
 */
class SpendingLimitServiceTest extends TestCase
{
    use RefreshDatabase;

    private SpendingLimitService $service;

    private Organization $organization;

    private User $user;

    protected function setUp(): void
    {
        parent::setUp();

        $this->service = new SpendingLimitService;
        $this->organization = Organization::factory()->create();
        $this->user = User::factory()->create(['role' => 'tenant']);
    }

    private function reservation(string $start, ?Organization $organization = null): Reservations
    {
        $organization ??= $this->organization;

        return Reservations::factory()->forOrganization($organization)->create([
            'start_date' => $start,
            'end_date' => Carbon::parse($start)->addMonths(2)->toDateString(),
        ]);
    }

    private function movement(
        WalletMovementType $type,
        string $amount,
        ?Reservations $reservation,
        ?User $user = null,
        ?Organization $organization = null,
    ): OrganizationWalletMovement {
        return OrganizationWalletMovement::factory()->create([
            'organization_id' => ($organization ?? $this->organization)->id,
            'user_id' => ($user ?? $this->user)->id,
            'reservation_id' => $reservation?->id,
            'type' => $type,
            'amount' => $amount,
        ]);
    }

    private function spent(string $month = '2026-11-15', ?User $user = null, ?Organization $organization = null): int
    {
        $user ??= $this->user;

        return $this->service->spentCentsByUser(
            ($organization ?? $this->organization)->id,
            Carbon::parse($month),
        )[$user->id] ?? 0;
    }

    private function setLimit(?string $limit, ?User $user = null): void
    {
        $this->organization->users()->syncWithoutDetaching([
            ($user ?? $this->user)->id => ['role' => 'member', 'monthly_limit' => $limit],
        ]);
    }

    // -- spent figure (ML-5) --

    public function test_spent_is_the_negated_net_of_reserva_and_reembolso_and_ignores_recargas()
    {
        $reservation = $this->reservation('2026-11-10');
        $this->movement(WalletMovementType::Reserva, '-300.00', $reservation);
        $this->movement(WalletMovementType::Reembolso, '100.00', $reservation);
        $this->movement(WalletMovementType::Recarga, '500.00', $reservation);

        $this->assertSame(20000, $this->spent());
    }

    public function test_a_partial_refund_frees_only_the_refunded_part_and_a_zero_refund_keeps_it_all()
    {
        $refunded = $this->reservation('2026-11-10');
        $this->movement(WalletMovementType::Reserva, '-800.00', $refunded);
        $this->movement(WalletMovementType::Reembolso, '400.00', $refunded);
        $this->assertSame(40000, $this->spent());

        $penalized = $this->reservation('2026-11-12');
        $this->movement(WalletMovementType::Reserva, '-800.00', $penalized);
        $this->assertSame(120000, $this->spent());
    }

    public function test_other_users_and_other_organizations_are_ignored()
    {
        $reservation = $this->reservation('2026-11-10');
        $other = User::factory()->create(['role' => 'tenant']);
        $otherOrganization = Organization::factory()->create();
        $foreign = $this->reservation('2026-11-10', $otherOrganization);
        $this->movement(WalletMovementType::Reserva, '-300.00', $reservation);
        $this->movement(WalletMovementType::Reserva, '-700.00', $this->reservation('2026-11-11'), $other);
        $this->movement(WalletMovementType::Reserva, '-900.00', $foreign, $this->user, $otherOrganization);

        $this->assertSame(30000, $this->spent());
        $this->assertSame(70000, $this->spent('2026-11-15', $other));
    }

    public function test_a_movement_without_a_reservation_is_excluded()
    {
        $this->movement(WalletMovementType::Reserva, '-300.00', null);

        $this->assertSame(0, $this->spent());
    }

    public function test_reservations_without_wallet_movements_add_nothing()
    {
        $this->reservation('2026-11-10');
        Reservations::factory()->create(['start_date' => '2026-11-10', 'end_date' => '2026-12-10', 'organization_id' => null]);

        $this->assertSame(0, $this->spent());
    }

    public function test_cents_are_summed_exactly()
    {
        foreach (['2026-11-01', '2026-11-02', '2026-11-03'] as $start) {
            $this->movement(WalletMovementType::Reserva, '-33.33', $this->reservation($start));
        }

        $this->assertSame(9999, $this->spent());
    }

    // -- month attribution (ML-4) --

    /**
     * @return array<string, array{string, string, string}>
     */
    public static function monthBoundaries(): array
    {
        return [
            '28-day month' => ['2027-02-15', '2027-02-28', '2027-03-01'],
            '29-day month' => ['2028-02-15', '2028-02-29', '2028-03-01'],
            '30-day month' => ['2026-04-15', '2026-04-30', '2026-05-01'],
            '31-day month' => ['2026-10-15', '2026-10-31', '2026-11-01'],
        ];
    }

    #[DataProvider('monthBoundaries')]
    public function test_the_first_and_last_day_are_in_the_month_and_the_neighbours_are_out(string $inside, string $last, string $nextFirst)
    {
        $month = Carbon::parse($inside);
        $first = $month->copy()->startOfMonth()->toDateString();
        $previousLast = $month->copy()->startOfMonth()->subDay()->toDateString();

        foreach ([$first, $last] as $day) {
            $this->movement(WalletMovementType::Reserva, '-10.00', $this->reservation($day));
        }
        foreach ([$previousLast, $nextFirst] as $day) {
            $this->movement(WalletMovementType::Reserva, '-1000.00', $this->reservation($day));
        }

        $this->assertSame(2000, $this->spent($inside));
    }

    public function test_a_multi_month_booking_counts_in_its_start_month_only()
    {
        $reservation = Reservations::factory()->forOrganization($this->organization)->create([
            'start_date' => '2026-11-30',
            'end_date' => '2026-12-15',
        ]);
        $this->movement(WalletMovementType::Reserva, '-1500.00', $reservation);

        $this->assertSame(150000, $this->spent('2026-11-01'));
        $this->assertSame(0, $this->spent('2026-12-01'));
    }

    public function test_the_user_filter_limits_the_result_to_one_user()
    {
        $other = User::factory()->create(['role' => 'tenant']);
        $reservation = $this->reservation('2026-11-10');
        $this->movement(WalletMovementType::Reserva, '-300.00', $reservation);
        $this->movement(WalletMovementType::Reserva, '-700.00', $this->reservation('2026-11-11'), $other);

        $result = $this->service->spentCentsByUser($this->organization->id, Carbon::parse('2026-11-15'), $this->user->id);

        $this->assertSame([$this->user->id => 30000], $result);
    }

    // -- formatLimit --

    public function test_format_limit_normalizes_every_driver_shape_to_a_scale_2_string()
    {
        $this->assertSame('250.00', SpendingLimitService::formatLimit(250));
        $this->assertSame('250.50', SpendingLimitService::formatLimit(250.5));
        $this->assertSame('1500.50', SpendingLimitService::formatLimit('1500.50'));
        $this->assertSame('999999.99', SpendingLimitService::formatLimit('999999.99'));
        $this->assertNull(SpendingLimitService::formatLimit(null));
    }

    // -- guard (ML-3) --

    public function test_limit_cents_reads_the_pivot_fresh_and_a_missing_row_is_unlimited()
    {
        $this->assertNull($this->service->limitCents($this->organization->id, $this->user->id));

        $this->setLimit('250.50');
        $this->assertSame(25050, $this->service->limitCents($this->organization->id, $this->user->id));

        DB::table('organization_user')->where('user_id', $this->user->id)->update(['monthly_limit' => null]);
        $this->assertNull($this->service->limitCents($this->organization->id, $this->user->id));
    }

    public function test_a_total_equal_to_the_remaining_allowance_passes_and_one_cent_more_throws()
    {
        $this->setLimit('1000.00');
        $this->movement(WalletMovementType::Reserva, '-600.00', $this->reservation('2026-11-05'));
        $target = $this->reservation('2026-11-20');

        $this->service->assertMaySpend($this->organization, $this->user->id, $target, '400.00');
        $this->addToAssertionCount(1);

        try {
            $this->service->assertMaySpend($this->organization, $this->user->id, $target, '400.01');
            $this->fail('Expected the limit to be exceeded.');
        } catch (MonthlyLimitExceededException $e) {
            $this->assertSame(
                ['monthly_limit' => ['Esta reserva supera tu límite mensual. Pide a un administrador que lo aumente.']],
                $e->errors(),
            );
        }
    }

    public function test_a_null_limit_never_runs_the_spend_query()
    {
        $this->setLimit(null);
        $target = $this->reservation('2026-11-20');

        DB::enableQueryLog();
        $this->service->assertMaySpend($this->organization, $this->user->id, $target, '999999.99');
        $queries = collect(DB::getQueryLog())->pluck('query')->implode("\n");
        DB::disableQueryLog();

        $this->assertStringNotContainsString('organization_wallet_movements', $queries);
    }

    public function test_the_arithmetic_is_exact_in_cents()
    {
        $this->setLimit('100.10');
        $this->movement(WalletMovementType::Reserva, '-0.10', $this->reservation('2026-11-05'));

        $this->service->assertMaySpend($this->organization, $this->user->id, $this->reservation('2026-11-20'), '100.00');
        $this->addToAssertionCount(1);
    }

    public function test_the_guard_only_counts_the_start_month_of_the_reservation()
    {
        $this->setLimit('1000.00');
        $this->movement(WalletMovementType::Reserva, '-900.00', $this->reservation('2026-10-31'));

        $this->service->assertMaySpend($this->organization, $this->user->id, $this->reservation('2026-11-01'), '1000.00');
        $this->addToAssertionCount(1);
    }

    public function test_the_guard_outside_a_transaction_is_a_programming_error()
    {
        $target = $this->reservation('2026-11-20');

        // RefreshDatabase wraps each test in a transaction; step out of it.
        DB::rollBack();

        try {
            $this->expectException(LogicException::class);
            $this->service->assertMaySpend($this->organization, $this->user->id, $target, '10.00');
        } finally {
            DB::beginTransaction();
        }
    }
}
