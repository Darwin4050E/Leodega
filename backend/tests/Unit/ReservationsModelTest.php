<?php

namespace Tests\Unit;

use App\Models\Reservations;
use App\Models\StoreRooms;
use App\Models\Tenants;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * sdd/tenant-self-cancel reconciliation #2: `isCancellableByTenant()` MUST
 * mirror `isCancellableByLandlord()`'s eligibility gate exactly --
 * `start_date > today()`, server-side `Carbon::today()`, date-only. A
 * reservation whose start date is reached or passed is never cancellable
 * via this gate, regardless of tier.
 */
class ReservationsModelTest extends TestCase
{
    use RefreshDatabase;

    private function reservation(array $overrides = []): Reservations
    {
        $room = StoreRooms::factory()->create();
        $tenant = Tenants::factory()->create();

        return Reservations::factory()->create(array_merge([
            'store_room_id' => $room->id,
            'tenant_id' => $tenant->id,
        ], $overrides));
    }

    public function test_confirmed_reservation_starting_tomorrow_is_cancellable_by_tenant()
    {
        $reservation = $this->reservation([
            'status' => 'confirmed',
            'start_date' => today()->addDay()->toDateString(),
        ]);

        $this->assertTrue($reservation->isCancellableByTenant());
    }

    public function test_pending_reservation_starting_tomorrow_is_cancellable_by_tenant()
    {
        $reservation = $this->reservation([
            'status' => 'pending',
            'start_date' => today()->addDay()->toDateString(),
        ]);

        $this->assertTrue($reservation->isCancellableByTenant());
    }

    public function test_reservation_starting_today_is_not_cancellable_by_tenant()
    {
        $reservation = $this->reservation([
            'status' => 'confirmed',
            'start_date' => today()->toDateString(),
        ]);

        $this->assertFalse($reservation->isCancellableByTenant());
    }

    public function test_reservation_that_already_started_is_not_cancellable_by_tenant()
    {
        $reservation = $this->reservation([
            'status' => 'confirmed',
            'start_date' => today()->subDay()->toDateString(),
        ]);

        $this->assertFalse($reservation->isCancellableByTenant());
    }

    public function test_already_canceled_reservation_is_not_cancellable_by_tenant()
    {
        $reservation = $this->reservation([
            'status' => 'canceled',
            'start_date' => today()->addDay()->toDateString(),
        ]);

        $this->assertFalse($reservation->isCancellableByTenant());
    }

    // -- sdd/hug02-payment-hold-expiry: holdCutoff/scopeActiveHold/scopeExpiredHold/isExpiredHold --

    protected function tearDown(): void
    {
        Carbon::setTestNow();
        parent::tearDown();
    }

    public function test_hold_cutoff_is_now_minus_configured_hold_minutes()
    {
        Carbon::setTestNow('2026-01-01 12:00:00');
        config(['reservations.payment_hold_minutes' => 15]);

        $cutoff = (new Reservations)->holdCutoff();

        $this->assertSame('2026-01-01 11:45:00', $cutoff->toDateTimeString());
    }

    public function test_scope_active_hold_includes_row_created_before_cutoff()
    {
        config(['reservations.payment_hold_minutes' => 15]);
        Carbon::setTestNow('2026-01-01 12:00:00');

        $reservation = $this->reservation([
            'status' => 'pending',
            'created_at' => Carbon::parse('2026-01-01 11:50:00'),
        ]);

        $this->assertTrue(Reservations::activeHold()->where('id', $reservation->id)->exists());
    }

    public function test_scope_active_hold_excludes_row_created_exactly_at_cutoff()
    {
        config(['reservations.payment_hold_minutes' => 15]);
        Carbon::setTestNow('2026-01-01 12:00:00');

        $reservation = $this->reservation([
            'status' => 'pending',
            'created_at' => Carbon::parse('2026-01-01 11:45:00'),
        ]);

        $this->assertFalse(Reservations::activeHold()->where('id', $reservation->id)->exists());
    }

    public function test_scope_expired_hold_includes_row_created_exactly_at_cutoff()
    {
        config(['reservations.payment_hold_minutes' => 15]);
        Carbon::setTestNow('2026-01-01 12:00:00');

        $reservation = $this->reservation([
            'status' => 'pending',
            'created_at' => Carbon::parse('2026-01-01 11:45:00'),
        ]);

        $this->assertTrue(Reservations::expiredHold()->where('id', $reservation->id)->exists());
    }

    public function test_scope_expired_hold_excludes_row_created_after_cutoff()
    {
        config(['reservations.payment_hold_minutes' => 15]);
        Carbon::setTestNow('2026-01-01 12:00:00');

        $reservation = $this->reservation([
            'status' => 'pending',
            'created_at' => Carbon::parse('2026-01-01 11:50:00'),
        ]);

        $this->assertFalse(Reservations::expiredHold()->where('id', $reservation->id)->exists());
    }

    public function test_is_expired_hold_is_false_before_cutoff()
    {
        config(['reservations.payment_hold_minutes' => 15]);
        Carbon::setTestNow('2026-01-01 12:00:00');

        $reservation = $this->reservation([
            'status' => 'pending',
            'created_at' => Carbon::parse('2026-01-01 11:50:00'),
        ]);

        $this->assertFalse($reservation->isExpiredHold());
    }

    public function test_is_expired_hold_is_true_exactly_at_cutoff()
    {
        config(['reservations.payment_hold_minutes' => 15]);
        Carbon::setTestNow('2026-01-01 12:00:00');

        $reservation = $this->reservation([
            'status' => 'pending',
            'created_at' => Carbon::parse('2026-01-01 11:45:00'),
        ]);

        $this->assertTrue($reservation->isExpiredHold());
    }

    public function test_is_expired_hold_is_true_after_cutoff()
    {
        config(['reservations.payment_hold_minutes' => 15]);
        Carbon::setTestNow('2026-01-01 12:00:00');

        $reservation = $this->reservation([
            'status' => 'pending',
            'created_at' => Carbon::parse('2026-01-01 11:00:00'),
        ]);

        $this->assertTrue($reservation->isExpiredHold());
    }
}
