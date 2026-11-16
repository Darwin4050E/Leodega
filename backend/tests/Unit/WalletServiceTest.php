<?php

namespace Tests\Unit;

use App\Enums\WalletMovementType;
use App\Exceptions\InsufficientWalletBalanceException;
use App\Models\Organization;
use App\Models\OrganizationWalletMovement;
use App\Models\Reservations;
use App\Models\User;
use App\Services\WalletService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use InvalidArgumentException;
use LogicException;
use RuntimeException;
use Tests\TestCase;

/**
 * org-wallet OW-2, OW-3, OW-4, OW-6, OW-7: the only writer of the balance and
 * of the ledger. SQLite ignores row locks, so these tests prove the money
 * rules; the lock itself is covered by OrganizationWalletLockingTest.
 */
class WalletServiceTest extends TestCase
{
    use RefreshDatabase;

    private WalletService $wallet;

    protected function setUp(): void
    {
        parent::setUp();
        $this->wallet = new WalletService;
    }

    private function reservationFor(Organization $organization): Reservations
    {
        return Reservations::factory()->forOrganization($organization)->create();
    }

    private function assertNothingWritten(Organization $organization, string $balance): void
    {
        $this->assertSame($balance, $organization->fresh()->wallet_balance);
        $this->assertSame(0, OrganizationWalletMovement::where('organization_id', $organization->id)->count());
    }

    // -- top-up (OW-4) --

    public function test_top_up_credits_the_balance_and_writes_one_recarga_for_the_actor()
    {
        $organization = Organization::factory()->create();
        $admin = User::factory()->create();

        $movement = $this->wallet->topUp($organization, $admin, '50.00');

        $this->assertSame(WalletMovementType::Recarga, $movement->type);
        $this->assertSame('50.00', $movement->fresh()->amount);
        $this->assertSame('50.00', $movement->fresh()->balance_after);
        $this->assertSame($admin->id, $movement->user_id);
        $this->assertNull($movement->reservation_id);
        $this->assertSame('50.00', $organization->fresh()->wallet_balance);
    }

    public function test_every_top_up_writes_its_own_movement()
    {
        $organization = Organization::factory()->withBalance('10.00')->create();
        $admin = User::factory()->create();

        $this->wallet->topUp($organization, $admin, '50.00');
        $this->wallet->topUp($organization, $admin, '50.00');

        $this->assertSame('110.00', $organization->fresh()->wallet_balance);
        $this->assertSame(2, $organization->walletMovements()->count());
    }

    public function test_top_up_rejects_more_than_two_decimals_without_rounding()
    {
        $organization = Organization::factory()->create();

        try {
            $this->wallet->topUp($organization, User::factory()->create(), '100.005');
            $this->fail('A 3-decimal amount must be rejected.');
        } catch (InvalidArgumentException) {
            $this->assertNothingWritten($organization, '0.00');
        }
    }

    public function test_top_up_beyond_the_column_capacity_is_a_422_and_changes_nothing()
    {
        $organization = Organization::factory()->withBalance('99999999.00')->create();

        try {
            $this->wallet->topUp($organization, User::factory()->create(), '50.00');
            $this->fail('A top-up over the capacity must be rejected.');
        } catch (ValidationException $e) {
            $this->assertSame(422, $e->status);
            $this->assertNothingWritten($organization, '99999999.00');
        }
    }

    // -- debit (OW-6) --

    public function test_debit_writes_a_negative_reserva_linked_to_the_reservation()
    {
        $organization = Organization::factory()->withBalance('100.00')->create();
        $creator = User::factory()->create();
        $reservation = $this->reservationFor($organization);

        $locked = $this->wallet->lockOrganization($organization->id);
        $movement = $this->wallet->debitForReservation($locked, $reservation, '40.00', $creator->id);

        $movement = $movement->fresh();
        $this->assertSame(WalletMovementType::Reserva, $movement->type);
        $this->assertSame('-40.00', $movement->amount);
        $this->assertSame('60.00', $movement->balance_after);
        $this->assertSame($creator->id, $movement->user_id);
        $this->assertSame($reservation->id, $movement->reservation_id);
        $this->assertSame('60.00', $organization->fresh()->wallet_balance);
    }

    public function test_a_debit_of_one_cent_more_than_the_balance_is_rejected_and_writes_nothing()
    {
        $organization = Organization::factory()->withBalance('50.00')->create();
        $reservation = $this->reservationFor($organization);
        $locked = $this->wallet->lockOrganization($organization->id);

        try {
            $this->wallet->debitForReservation($locked, $reservation, '50.01', User::factory()->create()->id);
            $this->fail('An overdraft must be rejected.');
        } catch (InsufficientWalletBalanceException $e) {
            $this->assertSame(422, $e->status);
            $this->assertSame('Saldo insuficiente en la organización', $e->getMessage());
            $this->assertSame(['Saldo insuficiente en la organización'], $e->errors()['wallet']);
            $this->assertNothingWritten($organization, '50.00');
        }
    }

    public function test_a_debit_equal_to_the_balance_is_allowed_and_leaves_zero()
    {
        $organization = Organization::factory()->withBalance('50.00')->create();
        $reservation = $this->reservationFor($organization);
        $locked = $this->wallet->lockOrganization($organization->id);

        $movement = $this->wallet->debitForReservation($locked, $reservation, '50.00', User::factory()->create()->id);

        $this->assertSame('0.00', $movement->fresh()->balance_after);
        $this->assertSame('0.00', $organization->fresh()->wallet_balance);
    }

    public function test_any_debit_from_an_empty_wallet_is_rejected()
    {
        $organization = Organization::factory()->create();
        $reservation = $this->reservationFor($organization);
        $locked = $this->wallet->lockOrganization($organization->id);

        $this->expectException(InsufficientWalletBalanceException::class);
        $this->wallet->debitForReservation($locked, $reservation, '0.01', User::factory()->create()->id);
    }

    // -- refund credit (OW-7, OW-3) --

    public function test_credit_refund_writes_a_reembolso_for_the_creator()
    {
        $organization = Organization::factory()->withBalance('10.00')->create();
        $creator = User::factory()->create();
        $reservation = $this->reservationFor($organization);
        $locked = $this->wallet->lockOrganization($organization->id);

        $movement = $this->wallet->creditRefund($locked, $reservation, '5.01', $creator->id);

        $this->assertSame(WalletMovementType::Reembolso, $movement->type);
        $this->assertSame('5.01', $movement->fresh()->amount);
        $this->assertSame('15.01', $movement->fresh()->balance_after);
        $this->assertSame($creator->id, $movement->user_id);
        $this->assertSame('15.01', $organization->fresh()->wallet_balance);
    }

    public function test_crediting_the_same_reservation_twice_writes_one_movement_and_one_credit()
    {
        $organization = Organization::factory()->withBalance('10.00')->create();
        $creator = User::factory()->create();
        $reservation = $this->reservationFor($organization);

        $first = $this->wallet->creditRefund($this->wallet->lockOrganization($organization->id), $reservation, '20.00', $creator->id);
        $second = $this->wallet->creditRefund($this->wallet->lockOrganization($organization->id), $reservation, '20.00', $creator->id);

        $this->assertNotNull($first);
        $this->assertNull($second);
        $this->assertSame(1, $organization->walletMovements()->count());
        $this->assertSame('30.00', $organization->fresh()->wallet_balance);
    }

    public function test_a_zero_refund_writes_no_movement()
    {
        $organization = Organization::factory()->withBalance('10.00')->create();
        $reservation = $this->reservationFor($organization);
        $locked = $this->wallet->lockOrganization($organization->id);

        $this->assertNull($this->wallet->creditRefund($locked, $reservation, '0.00', User::factory()->create()->id));
        $this->assertSame(0, $organization->walletMovements()->count());
        $this->assertSame('10.00', $organization->fresh()->wallet_balance);
    }

    // -- lock and atomicity (OW-2, OW-6) --

    public function test_locking_outside_a_transaction_is_a_programming_error()
    {
        $organization = Organization::factory()->create();

        // RefreshDatabase wraps each test in a transaction; step out of it.
        DB::rollBack();

        try {
            $this->expectException(LogicException::class);
            $this->wallet->lockOrganization($organization->id);
        } finally {
            DB::beginTransaction();
        }
    }

    public function test_lock_returns_a_fresh_instance_not_the_stale_one()
    {
        $organization = Organization::factory()->withBalance('10.00')->create();
        DB::table('organizations')->where('id', $organization->id)->update(['wallet_balance' => '70.00']);

        $locked = $this->wallet->lockOrganization($organization->id);

        $this->assertSame('70.00', $locked->wallet_balance);
        $this->assertSame('10.00', $organization->wallet_balance);
    }

    public function test_a_failure_while_writing_the_movement_rolls_the_balance_back()
    {
        $organization = Organization::factory()->withBalance('10.00')->create();
        OrganizationWalletMovement::creating(fn () => throw new RuntimeException('disk full'));

        try {
            $this->wallet->topUp($organization, User::factory()->create(), '50.00');
            $this->fail('The failure must propagate.');
        } catch (RuntimeException) {
            $this->assertNothingWritten($organization, '10.00');
        }
    }

    public function test_the_ledger_sums_to_the_balance_and_to_the_last_balance_after()
    {
        $organization = Organization::factory()->create();
        $user = User::factory()->create();
        $reservation = $this->reservationFor($organization);

        $this->wallet->topUp($organization, $user, '100.00');
        $this->wallet->debitForReservation($this->wallet->lockOrganization($organization->id), $reservation, '30.00', $user->id);
        $this->wallet->creditRefund($this->wallet->lockOrganization($organization->id), $reservation, '10.50', $user->id);

        $movements = $organization->walletMovements()->orderBy('id')->get();
        $sum = $movements->sum(fn ($m) => (int) round((float) $m->amount * 100));

        $this->assertSame(8050, $sum);
        $this->assertSame('80.50', $organization->fresh()->wallet_balance);
        $this->assertSame('80.50', $movements->last()->balance_after);
    }
}
