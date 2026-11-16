<?php

namespace Tests\Unit;

use App\Models\Organization;
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

    // -- HUE-05 D12 (refined, decision #589): organization() relation and
    // the active-organization-hold scope backing the account-deletion 409
    // guard (UserController::destroySelf, U1b). "Active" = a `confirmed`
    // reservation that has not ended yet, OR an unexpired `pending` hold. --

    public function test_organization_relation_resolves_the_owning_organization()
    {
        $organization = Organization::factory()->create();
        $reservation = $this->reservation(['organization_id' => $organization->id]);

        $this->assertTrue($reservation->organization()->getResults()->is($organization));
    }

    public function test_organization_relation_is_null_for_a_personal_reservation()
    {
        $reservation = $this->reservation();

        $this->assertNull($reservation->organization);
    }

    public function test_active_organization_hold_scope_includes_confirmed_reservation_ending_in_the_future()
    {
        $organization = Organization::factory()->create();
        $tenant = Tenants::factory()->create();
        $reservation = $this->reservation([
            'tenant_id' => $tenant->id,
            'organization_id' => $organization->id,
            'status' => 'confirmed',
            'end_date' => today()->addDay()->toDateString(),
        ]);

        $this->assertTrue(
            Reservations::activeOrganizationHoldFor($tenant->id)->where('id', $reservation->id)->exists()
        );
    }

    public function test_active_organization_hold_scope_excludes_confirmed_reservation_that_already_ended()
    {
        $organization = Organization::factory()->create();
        $tenant = Tenants::factory()->create();
        $reservation = $this->reservation([
            'tenant_id' => $tenant->id,
            'organization_id' => $organization->id,
            'status' => 'confirmed',
            'end_date' => today()->subDay()->toDateString(),
        ]);

        $this->assertFalse(
            Reservations::activeOrganizationHoldFor($tenant->id)->where('id', $reservation->id)->exists()
        );
    }

    public function test_active_organization_hold_scope_includes_unexpired_pending_hold()
    {
        config(['reservations.payment_hold_minutes' => 15]);
        Carbon::setTestNow('2026-01-01 12:00:00');
        $organization = Organization::factory()->create();
        $tenant = Tenants::factory()->create();
        $reservation = $this->reservation([
            'tenant_id' => $tenant->id,
            'organization_id' => $organization->id,
            'status' => 'pending',
            'created_at' => Carbon::parse('2026-01-01 11:55:00'),
        ]);

        $this->assertTrue(
            Reservations::activeOrganizationHoldFor($tenant->id)->where('id', $reservation->id)->exists()
        );
    }

    public function test_active_organization_hold_scope_excludes_expired_pending_hold()
    {
        config(['reservations.payment_hold_minutes' => 15]);
        Carbon::setTestNow('2026-01-01 12:00:00');
        $organization = Organization::factory()->create();
        $tenant = Tenants::factory()->create();
        $reservation = $this->reservation([
            'tenant_id' => $tenant->id,
            'organization_id' => $organization->id,
            'status' => 'pending',
            'created_at' => Carbon::parse('2026-01-01 11:00:00'),
        ]);

        $this->assertFalse(
            Reservations::activeOrganizationHoldFor($tenant->id)->where('id', $reservation->id)->exists()
        );
    }

    public function test_active_organization_hold_scope_excludes_canceled_reservation()
    {
        $organization = Organization::factory()->create();
        $tenant = Tenants::factory()->create();
        $reservation = $this->reservation([
            'tenant_id' => $tenant->id,
            'organization_id' => $organization->id,
            'status' => 'canceled',
            'end_date' => today()->addDay()->toDateString(),
        ]);

        $this->assertFalse(
            Reservations::activeOrganizationHoldFor($tenant->id)->where('id', $reservation->id)->exists()
        );
    }

    public function test_active_organization_hold_scope_excludes_personal_reservations()
    {
        $tenant = Tenants::factory()->create();
        $reservation = $this->reservation([
            'tenant_id' => $tenant->id,
            'organization_id' => null,
            'status' => 'confirmed',
            'end_date' => today()->addDay()->toDateString(),
        ]);

        $this->assertFalse(
            Reservations::activeOrganizationHoldFor($tenant->id)->where('id', $reservation->id)->exists()
        );
    }
}
