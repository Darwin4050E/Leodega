<?php

namespace Tests\Unit;

use App\Models\Reservations;
use App\Models\StoreRooms;
use App\Models\Tenants;
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
}
