<?php

namespace Tests\Unit;

use App\Exceptions\ReservationConflictException;
use App\Models\Landlords;
use App\Models\ReservationCancellationObligation;
use App\Models\Reservations;
use App\Models\StorePrices;
use App\Models\StoreRooms;
use App\Models\Tenants;
use App\Models\User;
use App\Services\ReservationPricingService;
use App\Services\ReservationService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ReservationServiceTest extends TestCase
{
    use RefreshDatabase;

    private function service(): ReservationService
    {
        return new ReservationService(new ReservationPricingService);
    }

    private function monthPriceFor(StoreRooms $room, int $price = 1000): void
    {
        StorePrices::factory()->create([
            'store_room_id' => $room->id,
            'mode' => 'month',
            'price' => $price,
            'disponibility' => true,
        ]);
    }

    public function test_create_persists_reservation_with_server_computed_total()
    {
        $landlordUser = User::factory()->create(['role' => 'landlord']);
        $landlord = Landlords::factory()->create(['user_id' => $landlordUser->id]);
        $room = StoreRooms::factory()->create(['landlord_id' => $landlord->id]);
        $this->monthPriceFor($room);
        $tenant = Tenants::factory()->create();

        $reservation = $this->service()->create($tenant, $room, [
            'start_date' => '2026-02-01',
            'end_date' => '2026-05-01',
        ], $tenant->user_id);

        $this->assertDatabaseHas('reservations', [
            'id' => $reservation->id,
            'store_room_id' => $room->id,
            'tenant_id' => $tenant->id,
            'status' => 'pending',
            'rent_subtotal' => '3000.00',
            // Rent only: the deposit is zero, so the total is the rent.
            'total_mount' => '3000.00',
        ]);
    }

    /**
     * create() no longer dispatches a create-time landlord notification:
     * nothing meaningful to tell before payment happens under instant-book.
     */
    public function test_create_does_not_notify_the_landlord()
    {
        $landlordUser = User::factory()->create(['role' => 'landlord']);
        $landlord = Landlords::factory()->create(['user_id' => $landlordUser->id]);
        $room = StoreRooms::factory()->create(['landlord_id' => $landlord->id]);
        $this->monthPriceFor($room);
        $tenant = Tenants::factory()->create();

        $this->service()->create($tenant, $room, [
            'start_date' => '2026-02-01',
            'end_date' => '2026-05-01',
        ], $tenant->user_id);

        $this->assertDatabaseCount('notifications', 0);
    }

    /**
     * sdd/tenant-self-cancel decision #339: the tier is snapshotted at
     * booking time so a later change to the storeroom's tier never affects
     * an already-paying tenant's refund. Persisted here, read only by
     * CancellationRefundCalculator later.
     */
    public function test_create_snapshots_the_room_current_cancellation_policy_tier()
    {
        $room = StoreRooms::factory()->create(['cancellation_policy_tier' => 'moderada']);
        $this->monthPriceFor($room);
        $tenant = Tenants::factory()->create();

        $reservation = $this->service()->create($tenant, $room, [
            'start_date' => '2026-02-01',
            'end_date' => '2026-05-01',
        ], $tenant->user_id);

        $this->assertDatabaseHas('reservations', [
            'id' => $reservation->id,
            'cancellation_policy_tier' => 'moderada',
        ]);
    }

    public function test_create_throws_when_dates_overlap_a_confirmed_reservation()
    {
        $room = StoreRooms::factory()->create();
        $this->monthPriceFor($room);
        $tenant = Tenants::factory()->create();

        Reservations::factory()->create([
            'store_room_id' => $room->id,
            'start_date' => '2026-03-01',
            'end_date' => '2026-03-10',
            'status' => 'confirmed',
        ]);

        $this->expectException(ReservationConflictException::class);

        $this->service()->create($tenant, $room, [
            'start_date' => '2026-03-05',
            'end_date' => '2026-03-12',
        ], $tenant->user_id);
    }

    /**
     * Esta es la lógica más importante y menos obvia de todo el módulo:
     * confirmar una reserva cancela en cascada cualquier OTRA reserva
     * "pending" de la misma bodega que se solape en fechas. No tenía ningún
     * test que la cubriera antes de esta extracción.
     */
    public function test_confirm_cascades_cancellation_to_overlapping_pending_reservations()
    {
        $tenantUser = User::factory()->create();
        $tenant = Tenants::factory()->create(['user_id' => $tenantUser->id]);
        $room = StoreRooms::factory()->create();

        $winner = Reservations::factory()->create([
            'store_room_id' => $room->id,
            'tenant_id' => $tenant->id,
            'start_date' => '2026-04-01',
            'end_date' => '2026-04-10',
            'status' => 'pending',
        ]);

        $overlapping = Reservations::factory()->create([
            'store_room_id' => $room->id,
            'tenant_id' => $tenant->id,
            'start_date' => '2026-04-05',
            'end_date' => '2026-04-15',
            'status' => 'pending',
        ]);

        $nonOverlapping = Reservations::factory()->create([
            'store_room_id' => $room->id,
            'tenant_id' => $tenant->id,
            'start_date' => '2026-05-01',
            'end_date' => '2026-05-10',
            'status' => 'pending',
        ]);

        $winner->load('storeRooms');
        $this->service()->confirm($winner, $tenantUser->id);

        $this->assertDatabaseHas('reservations', ['id' => $winner->id, 'status' => 'confirmed']);
        $this->assertDatabaseHas('reservations', [
            'id' => $overlapping->id,
            'status' => 'canceled',
            'cancelation_reason' => 'Blocked by confirmed reservation',
        ]);
        $this->assertDatabaseHas('reservations', ['id' => $nonOverlapping->id, 'status' => 'pending']);
        $this->assertDatabaseHas('notifications', [
            'receiver_id' => $tenantUser->id,
            'type' => 'reservation_confirmed',
        ]);
    }

    public function test_confirm_notifies_the_owning_landlord_of_the_paid_booking()
    {
        $tenantUser = User::factory()->create();
        $tenant = Tenants::factory()->create(['user_id' => $tenantUser->id]);
        $landlordUser = User::factory()->create(['role' => 'landlord']);
        $landlord = Landlords::factory()->create(['user_id' => $landlordUser->id]);
        $room = StoreRooms::factory()->create(['landlord_id' => $landlord->id]);

        $reservation = Reservations::factory()->create([
            'store_room_id' => $room->id,
            'tenant_id' => $tenant->id,
            'status' => 'pending',
        ]);
        $reservation->load('storeRooms');

        $this->service()->confirm($reservation, $tenantUser->id);

        $this->assertDatabaseHas('notifications', [
            'receiver_id' => $landlordUser->id,
            'type' => 'reservation_booked_and_paid',
        ]);
    }

    public function test_confirm_throws_when_another_confirmed_reservation_overlaps()
    {
        $tenant = Tenants::factory()->create();
        $room = StoreRooms::factory()->create();

        Reservations::factory()->create([
            'store_room_id' => $room->id,
            'start_date' => '2026-06-01',
            'end_date' => '2026-06-10',
            'status' => 'confirmed',
        ]);

        $pending = Reservations::factory()->create([
            'store_room_id' => $room->id,
            'tenant_id' => $tenant->id,
            'start_date' => '2026-06-05',
            'end_date' => '2026-06-12',
            'status' => 'pending',
        ]);
        $pending->load('storeRooms');

        $this->expectException(ReservationConflictException::class);

        $this->service()->confirm($pending, $tenant->user_id);
    }

    /**
     * sdd/payment-integrity (Slice C1): confirm() must reject a
     * confirmed -> confirmed self-transition. This guard is pure
     * defense-in-depth -- confirm() has exactly ONE production caller
     * (PaymentService::process()'s paid branch), which already filters
     * out non-pending reservations before ever calling confirm(). It
     * never fires on the live path today; it protects any future caller.
     */
    public function test_confirm_rejects_transition_from_confirmed_status()
    {
        $tenant = Tenants::factory()->create();
        $room = StoreRooms::factory()->create();

        $reservation = Reservations::factory()->create([
            'store_room_id' => $room->id,
            'tenant_id' => $tenant->id,
            'status' => 'confirmed',
        ]);
        $reservation->load('storeRooms');

        $this->expectException(ReservationConflictException::class);

        $this->service()->confirm($reservation, $tenant->user_id);
    }

    /**
     * sdd/payment-integrity (Slice C1): confirm() must reject a
     * canceled -> confirmed transition. This is the guard that closes
     * the resurrection bug from discovery #361 -- a canceled (and
     * possibly refunded) reservation must never be re-confirmed.
     */
    public function test_confirm_rejects_transition_from_canceled_status()
    {
        $tenant = Tenants::factory()->create();
        $room = StoreRooms::factory()->create();

        $reservation = Reservations::factory()->create([
            'store_room_id' => $room->id,
            'tenant_id' => $tenant->id,
            'status' => 'canceled',
        ]);
        $reservation->load('storeRooms');

        $this->expectException(ReservationConflictException::class);

        $this->service()->confirm($reservation, $tenant->user_id);
    }

    /**
     * Mirrors test_cancel_by_tenant_re_validates_against_the_locked_row_not_the_stale_instance:
     * confirm() must re-validate against the LOCKED row it re-fetches
     * inside its own transaction, never trust the $reservation instance
     * the caller passed in. Simulates a competing status mutation that
     * landed between the caller's read and this call by mutating the DB
     * row directly while the in-memory $reservation still reflects the
     * pre-mutation, eligible ("pending") state.
     */
    public function test_confirm_re_validates_against_the_locked_row_not_the_stale_instance()
    {
        $tenant = Tenants::factory()->create();
        $room = StoreRooms::factory()->create();

        $reservation = Reservations::factory()->create([
            'store_room_id' => $room->id,
            'tenant_id' => $tenant->id,
            'status' => 'pending',
        ]);
        $reservation->load('storeRooms');

        // A concurrent operation wins the race and cancels the row first.
        Reservations::where('id', $reservation->id)->update(['status' => 'canceled']);

        try {
            $this->service()->confirm($reservation, $tenant->user_id);
            $this->fail('Expected ReservationConflictException');
        } catch (ReservationConflictException $e) {
            $this->assertDatabaseCount('notifications', 0);
        }
    }

    public function test_cancel_by_landlord_creates_obligation_and_notifies_tenant_leaving_payment_untouched()
    {
        $tenantUser = User::factory()->create();
        $tenant = Tenants::factory()->create(['user_id' => $tenantUser->id]);
        $landlordUser = User::factory()->create(['role' => 'landlord']);
        $landlord = Landlords::factory()->create(['user_id' => $landlordUser->id]);
        $room = StoreRooms::factory()->create(['landlord_id' => $landlord->id]);

        $reservation = Reservations::factory()->create([
            'store_room_id' => $room->id,
            'tenant_id' => $tenant->id,
            'status' => 'confirmed',
            'start_date' => now()->addDays(5)->toDateString(),
            'end_date' => now()->addDays(35)->toDateString(),
            'rent_subtotal' => 3000,
            'total_mount' => 4000,
        ]);

        \App\Models\Payments::factory()->create([
            'reservation_id' => $reservation->id,
            'payment_state' => 'paid',
        ]);

        $result = $this->service()->cancelByLandlord($reservation, 'El almacen sufrio un incendio', $landlordUser->id);

        $this->assertSame('canceled', $result->status);
        $this->assertDatabaseHas('reservations', [
            'id' => $reservation->id,
            'status' => 'canceled',
        ]);
        $this->assertDatabaseHas('reservation_cancellation_obligations', [
            'reservation_id' => $reservation->id,
            'landlord_id' => $landlord->id,
            'refund_amount' => '4000.00',
            'penalty_amount' => '450.00',
            'penalty_rate' => '0.1500',
            'settlement_status' => 'pending_settlement',
        ]);
        $this->assertDatabaseHas('payments', [
            'reservation_id' => $reservation->id,
            'payment_state' => 'paid',
        ]);
        $this->assertDatabaseHas('notifications', [
            'receiver_id' => $tenantUser->id,
            'type' => 'reservation_canceled',
        ]);
    }

    /**
     * The obligation must still resolve its debtor landlord even after the
     * storeroom is soft-deleted (decision obs #141): landlord_id is
     * snapshotted on the obligation row, not resolved live through
     * reservation.storeRooms.landlord_id.
     */
    public function test_cancel_by_landlord_obligation_survives_storeroom_soft_delete()
    {
        $landlordUser = User::factory()->create(['role' => 'landlord']);
        $landlord = Landlords::factory()->create(['user_id' => $landlordUser->id]);
        $room = StoreRooms::factory()->create(['landlord_id' => $landlord->id]);
        $tenant = Tenants::factory()->create();

        $reservation = Reservations::factory()->create([
            'store_room_id' => $room->id,
            'tenant_id' => $tenant->id,
            'status' => 'confirmed',
            'start_date' => now()->addDays(5)->toDateString(),
            'end_date' => now()->addDays(35)->toDateString(),
            'rent_subtotal' => 3000,
            'total_mount' => 4000,
        ]);

        $this->service()->cancelByLandlord($reservation, 'El almacen sufrio un incendio', $landlordUser->id);

        // Now the reservation is canceled (does not block deletion), so the
        // gestor can soft-delete the storeroom.
        $room->delete();

        $obligation = ReservationCancellationObligation::where('reservation_id', $reservation->id)->firstOrFail();

        $this->assertNull($reservation->fresh()->storeRooms);
        $this->assertNotNull($obligation->landlord);
        $this->assertSame($landlord->id, $obligation->landlord->id);
    }

    public function test_cancel_by_landlord_rejects_reservation_starting_today()
    {
        $room = StoreRooms::factory()->create();
        $tenant = Tenants::factory()->create();

        $reservation = Reservations::factory()->create([
            'store_room_id' => $room->id,
            'tenant_id' => $tenant->id,
            'status' => 'confirmed',
            'start_date' => today()->toDateString(),
            'end_date' => today()->addDays(30)->toDateString(),
            'rent_subtotal' => 3000,
            'total_mount' => 4000,
        ]);

        try {
            $this->service()->cancelByLandlord($reservation, 'El almacen sufrio un incendio', $tenant->user_id);
            $this->fail('Expected ReservationConflictException');
        } catch (ReservationConflictException $e) {
            $this->assertDatabaseCount('reservation_cancellation_obligations', 0);
        }
    }

    public function test_cancel_by_landlord_rejects_reservation_already_started()
    {
        $room = StoreRooms::factory()->create();
        $tenant = Tenants::factory()->create();

        $reservation = Reservations::factory()->create([
            'store_room_id' => $room->id,
            'tenant_id' => $tenant->id,
            'status' => 'confirmed',
            'start_date' => today()->subDays(2)->toDateString(),
            'end_date' => today()->addDays(30)->toDateString(),
            'rent_subtotal' => 3000,
            'total_mount' => 4000,
        ]);

        try {
            $this->service()->cancelByLandlord($reservation, 'El almacen sufrio un incendio', $tenant->user_id);
            $this->fail('Expected ReservationConflictException');
        } catch (ReservationConflictException $e) {
            $this->assertDatabaseCount('reservation_cancellation_obligations', 0);
        }
    }

    public function test_cancel_by_landlord_rejects_unpaid_pending_reservation()
    {
        $room = StoreRooms::factory()->create();
        $tenant = Tenants::factory()->create();

        $reservation = Reservations::factory()->create([
            'store_room_id' => $room->id,
            'tenant_id' => $tenant->id,
            'status' => 'pending',
            'start_date' => now()->addDays(5)->toDateString(),
            'end_date' => now()->addDays(35)->toDateString(),
            'rent_subtotal' => 3000,
            'total_mount' => 4000,
        ]);

        try {
            $this->service()->cancelByLandlord($reservation, 'El almacen sufrio un incendio', $tenant->user_id);
            $this->fail('Expected ReservationConflictException');
        } catch (ReservationConflictException $e) {
            $this->assertDatabaseCount('reservation_cancellation_obligations', 0);
        }
    }

    public function test_cancel_by_landlord_rejects_already_canceled_reservation()
    {
        $room = StoreRooms::factory()->create();
        $tenant = Tenants::factory()->create();

        $reservation = Reservations::factory()->create([
            'store_room_id' => $room->id,
            'tenant_id' => $tenant->id,
            'status' => 'canceled',
            'start_date' => now()->addDays(5)->toDateString(),
            'end_date' => now()->addDays(35)->toDateString(),
            'rent_subtotal' => 3000,
            'total_mount' => 4000,
        ]);

        try {
            $this->service()->cancelByLandlord($reservation, 'El almacen sufrio un incendio', $tenant->user_id);
            $this->fail('Expected ReservationConflictException');
        } catch (ReservationConflictException $e) {
            $this->assertDatabaseCount('reservation_cancellation_obligations', 0);
        }
    }

    // -- sdd/tenant-self-cancel: cancelByTenant() -------------------------

    public function test_cancel_by_tenant_computes_refund_from_snapshotted_tier_and_cancels_confirmed_reservation()
    {
        $tenantUser = User::factory()->create();
        $tenant = Tenants::factory()->create(['user_id' => $tenantUser->id]);
        $landlordUser = User::factory()->create(['role' => 'landlord']);
        $landlord = Landlords::factory()->create(['user_id' => $landlordUser->id]);
        $room = StoreRooms::factory()->create([
            'landlord_id' => $landlord->id,
            // Room's LIVE tier differs from the reservation's snapshot on
            // purpose: the refund MUST be computed from the snapshot below,
            // never from this current value (decision #339).
            'cancellation_policy_tier' => 'estricta',
        ]);

        $reservation = Reservations::factory()->create([
            'store_room_id' => $room->id,
            'tenant_id' => $tenant->id,
            'status' => 'confirmed',
            'start_date' => now()->addDays(10)->toDateString(),
            'end_date' => now()->addDays(20)->toDateString(),
            'total_mount' => 100,
            'rent_subtotal' => 80,
            'cancellation_policy_tier' => 'flexible',
        ]);

        $result = $this->service()->cancelByTenant($reservation, null, $tenantUser->id);

        $this->assertSame('canceled', $result->status);
        $this->assertDatabaseHas('reservations', [
            'id' => $reservation->id,
            'status' => 'canceled',
            'refund_amount' => '100.00',
        ]);
    }

    public function test_cancel_by_tenant_records_zero_refund_for_a_pending_reservation()
    {
        $tenantUser = User::factory()->create();
        $tenant = Tenants::factory()->create(['user_id' => $tenantUser->id]);
        $room = StoreRooms::factory()->create(['cancellation_policy_tier' => 'flexible']);

        $reservation = Reservations::factory()->create([
            'store_room_id' => $room->id,
            'tenant_id' => $tenant->id,
            'status' => 'pending',
            'start_date' => now()->addDays(10)->toDateString(),
            'end_date' => now()->addDays(20)->toDateString(),
            'total_mount' => 100,
            'rent_subtotal' => 80,
            'cancellation_policy_tier' => 'flexible',
        ]);

        $result = $this->service()->cancelByTenant($reservation, null, $tenantUser->id);

        $this->assertSame('canceled', $result->status);
        $this->assertDatabaseHas('reservations', [
            'id' => $reservation->id,
            'status' => 'canceled',
            'refund_amount' => '0.00',
        ]);
    }

    public function test_cancel_by_tenant_rejects_a_reservation_whose_start_date_has_passed()
    {
        $tenant = Tenants::factory()->create();
        $room = StoreRooms::factory()->create();

        $reservation = Reservations::factory()->create([
            'store_room_id' => $room->id,
            'tenant_id' => $tenant->id,
            'status' => 'confirmed',
            'start_date' => today()->toDateString(),
            'end_date' => today()->addDays(10)->toDateString(),
            'cancellation_policy_tier' => 'flexible',
        ]);

        try {
            $this->service()->cancelByTenant($reservation, null, $tenant->user_id);
            $this->fail('Expected ReservationConflictException');
        } catch (ReservationConflictException $e) {
            $this->assertDatabaseHas('reservations', ['id' => $reservation->id, 'status' => 'confirmed']);
        }
    }

    /**
     * Proves cancelByTenant() re-validates against the row it locks INSIDE
     * the transaction, never trusting the $reservation instance the caller
     * passed in. Simulates a competing status mutation that landed between
     * the caller's read and this call (e.g. the landlord canceling first)
     * by mutating the DB row directly while the in-memory $reservation
     * still reflects the pre-mutation, eligible state.
     */
    public function test_cancel_by_tenant_re_validates_against_the_locked_row_not_the_stale_instance()
    {
        $tenant = Tenants::factory()->create();
        $room = StoreRooms::factory()->create();

        $reservation = Reservations::factory()->create([
            'store_room_id' => $room->id,
            'tenant_id' => $tenant->id,
            'status' => 'confirmed',
            'start_date' => now()->addDays(10)->toDateString(),
            'end_date' => now()->addDays(20)->toDateString(),
            'total_mount' => 100,
            'rent_subtotal' => 80,
            'cancellation_policy_tier' => 'flexible',
        ]);

        // A concurrent operation wins the race and cancels the row first.
        Reservations::where('id', $reservation->id)->update(['status' => 'canceled']);

        try {
            $this->service()->cancelByTenant($reservation, null, $tenant->user_id);
            $this->fail('Expected ReservationConflictException');
        } catch (ReservationConflictException $e) {
            $this->assertDatabaseCount('notifications', 0);
        }
    }

    public function test_cancel_by_tenant_is_idempotent_on_a_second_call()
    {
        $tenantUser = User::factory()->create();
        $tenant = Tenants::factory()->create(['user_id' => $tenantUser->id]);
        $room = StoreRooms::factory()->create(['cancellation_policy_tier' => 'flexible']);

        $reservation = Reservations::factory()->create([
            'store_room_id' => $room->id,
            'tenant_id' => $tenant->id,
            'status' => 'confirmed',
            'start_date' => now()->addDays(10)->toDateString(),
            'end_date' => now()->addDays(20)->toDateString(),
            'total_mount' => 100,
            'rent_subtotal' => 80,
            'cancellation_policy_tier' => 'flexible',
        ]);

        $this->service()->cancelByTenant($reservation, null, $tenantUser->id);
        $this->assertDatabaseCount('notifications', 1);

        try {
            $this->service()->cancelByTenant($reservation->fresh(), null, $tenantUser->id);
            $this->fail('Expected ReservationConflictException on the second cancel');
        } catch (ReservationConflictException $e) {
            $this->assertDatabaseHas('reservations', [
                'id' => $reservation->id,
                'refund_amount' => '100.00',
            ]);
            $this->assertDatabaseCount('notifications', 1);
        }
    }

    /**
     * [SPANISH COPY] The landlord notification is user-facing product text
     * (spec #341): neutral, professional Spanish, no voseo/slang.
     */
    public function test_cancel_by_tenant_notifies_the_landlord_with_the_exact_spanish_copy()
    {
        $tenantUser = User::factory()->create();
        $tenant = Tenants::factory()->create(['user_id' => $tenantUser->id]);
        $landlordUser = User::factory()->create(['role' => 'landlord']);
        $landlord = Landlords::factory()->create(['user_id' => $landlordUser->id]);
        $room = StoreRooms::factory()->create([
            'landlord_id' => $landlord->id,
            'cancellation_policy_tier' => 'flexible',
        ]);

        $reservation = Reservations::factory()->create([
            'store_room_id' => $room->id,
            'tenant_id' => $tenant->id,
            'status' => 'confirmed',
            'start_date' => now()->addDays(10)->toDateString(),
            'end_date' => now()->addDays(20)->toDateString(),
            'cancellation_policy_tier' => 'flexible',
        ]);

        $this->service()->cancelByTenant($reservation, null, $tenantUser->id);

        $this->assertDatabaseHas('notifications', [
            'receiver_id' => $landlordUser->id,
            'type' => 'reservation_canceled',
            'title' => 'Reserva cancelada por el cliente',
            'body' => 'El cliente canceló su reserva. Revisa el reembolso correspondiente.',
        ]);
    }

    public function test_cancel_by_landlord_rejects_reservation_with_no_rent_subtotal_snapshot()
    {
        $room = StoreRooms::factory()->create();
        $tenant = Tenants::factory()->create();

        $reservation = Reservations::factory()->create([
            'store_room_id' => $room->id,
            'tenant_id' => $tenant->id,
            'status' => 'confirmed',
            'start_date' => now()->addDays(5)->toDateString(),
            'end_date' => now()->addDays(35)->toDateString(),
            'rent_subtotal' => null,
            'total_mount' => 4000,
        ]);

        try {
            $this->service()->cancelByLandlord($reservation, 'El almacen sufrio un incendio', $tenant->user_id);
            $this->fail('Expected ReservationConflictException');
        } catch (ReservationConflictException $e) {
            $this->assertDatabaseCount('reservation_cancellation_obligations', 0);
        }
    }
}
