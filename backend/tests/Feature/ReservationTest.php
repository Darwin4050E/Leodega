<?php

namespace Tests\Feature;

use App\Models\Landlords;
use App\Models\Reservations;
use App\Models\StoreDisponibility;
use App\Models\StorePrices;
use App\Models\StoreRooms;
use App\Models\Tenants;
use App\Models\User;
use App\Services\ReservationService;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ReservationTest extends TestCase
{
    use RefreshDatabase;

    protected function tearDown(): void
    {
        Carbon::setTestNow();
        parent::tearDown();
    }

    /**
     * First day of next month: always in the future and free of month-end
     * overflow, so `+3 months` is exactly three billed months.
     */
    private function nextMonthStart(): Carbon
    {
        return today()->startOfMonth()->addMonth();
    }

    /** @test */
    public function tenant_can_create_reservation_for_available_store_room()
    {
        $user = User::factory()->create();
        $tenant = Tenants::factory()->create(['user_id' => $user->id]);
        $room = StoreRooms::factory()->approved()->create();
        StorePrices::factory()->create([
            'store_room_id' => $room->id,
            'mode' => 'month',
            'price' => 1000,
            'disponibility' => true,
        ]);

        $response = $this->actingAs($user, 'sanctum')
            ->postJson('/api/reservations', [
                'store_room_id' => $room->id,
                'start_date' => $this->nextMonthStart()->toDateString(),
                'end_date' => $this->nextMonthStart()->addMonths(3)->toDateString(),
            ]);

        $response->assertStatus(201);

        $this->assertDatabaseHas('reservations', [
            'store_room_id' => $room->id,
            'tenant_id' => $tenant->id,
            'status' => 'pending',
            'rent_subtotal' => '3000.00',
            // Rent only: the deposit is zero, so the total is the rent.
            'total_mount' => '3000.00',
        ]);
    }

    /**
     * Per decision obs #139: a client-supplied total_mount is IGNORED, not
     * rejected. The server-computed total must win regardless.
     */
    /** @test */
    public function client_supplied_total_mount_is_ignored_and_server_computes_the_real_total()
    {
        $user = User::factory()->create();
        $tenant = Tenants::factory()->create(['user_id' => $user->id]);
        $room = StoreRooms::factory()->approved()->create();
        StorePrices::factory()->create([
            'store_room_id' => $room->id,
            'mode' => 'month',
            'price' => 1000,
            'disponibility' => true,
        ]);

        $response = $this->actingAs($user, 'sanctum')
            ->postJson('/api/reservations', [
                'store_room_id' => $room->id,
                'start_date' => $this->nextMonthStart()->toDateString(),
                'end_date' => $this->nextMonthStart()->addMonths(3)->toDateString(),
                'total_mount' => 0,
            ]);

        $response->assertStatus(201);

        $this->assertDatabaseHas('reservations', [
            'store_room_id' => $room->id,
            'tenant_id' => $tenant->id,
            // Rent only: the deposit is zero, so the total is the rent.
            'total_mount' => '3000.00',
        ]);
    }

    /** @test */
    public function cannot_reserve_store_room_if_dates_are_already_confirmed()
    {
        $user = User::factory()->create();
        $tenant = Tenants::factory()->create(['user_id' => $user->id]);
        $room = StoreRooms::factory()->approved()->create();
        StorePrices::factory()->create([
            'store_room_id' => $room->id,
            'mode' => 'month',
            'price' => 1000,
            'disponibility' => true,
        ]);

        // Reserva confirmada existente
        Reservations::factory()->create([
            'store_room_id' => $room->id,
            'start_date' => today()->addDays(10)->toDateString(),
            'end_date' => today()->addDays(19)->toDateString(),
            'status' => 'confirmed',
        ]);

        $response = $this->actingAs($user, 'sanctum')
            ->postJson('/api/reservations', [
                'store_room_id' => $room->id,
                'start_date' => today()->addDays(14)->toDateString(),
                'end_date' => today()->addDays(21)->toDateString(),
            ]);

        $response->assertStatus(409);
        $response->assertJson([
            'message' => 'La bodega ya está reservada en esas fechas.',
        ]);
    }

    /** @test */
    public function cannot_reserve_when_store_room_has_no_month_price()
    {
        $user = User::factory()->create();
        Tenants::factory()->create(['user_id' => $user->id]);
        $room = StoreRooms::factory()->approved()->create();

        $response = $this->actingAs($user, 'sanctum')
            ->postJson('/api/reservations', [
                'store_room_id' => $room->id,
                'start_date' => $this->nextMonthStart()->toDateString(),
                'end_date' => $this->nextMonthStart()->addMonths(3)->toDateString(),
            ]);

        $response->assertStatus(422);
        $this->assertDatabaseCount('reservations', 0);
    }

    /**
     * RB-1 (publication guard): booking a room that is not approved is a 404
     * with no existence leak, and never writes a reservation row. The guard
     * lives in the controller; ReservationService::create stays agnostic
     * (see ReservationServiceTest).
     */
    /** @test */
    public function booking_a_pending_room_returns_404_and_creates_no_reservation()
    {
        $user = User::factory()->create();
        Tenants::factory()->create(['user_id' => $user->id]);
        $room = StoreRooms::factory()->create(['publication_status' => 'pending']);
        StorePrices::factory()->create([
            'store_room_id' => $room->id,
            'mode' => 'month',
            'price' => 1000,
            'disponibility' => true,
        ]);

        $this->actingAs($user, 'sanctum')
            ->postJson('/api/reservations', [
                'store_room_id' => $room->id,
                'start_date' => today()->addDays(5)->toDateString(),
                'end_date' => today()->addDays(10)->toDateString(),
            ])
            ->assertStatus(404);

        $this->assertDatabaseCount('reservations', 0);
    }

    /** @test */
    public function booking_a_rejected_room_returns_404_and_creates_no_reservation()
    {
        $user = User::factory()->create();
        Tenants::factory()->create(['user_id' => $user->id]);
        $room = StoreRooms::factory()->create(['publication_status' => 'rejected']);
        StorePrices::factory()->create([
            'store_room_id' => $room->id,
            'mode' => 'month',
            'price' => 1000,
            'disponibility' => true,
        ]);

        $this->actingAs($user, 'sanctum')
            ->postJson('/api/reservations', [
                'store_room_id' => $room->id,
                'start_date' => today()->addDays(5)->toDateString(),
                'end_date' => today()->addDays(10)->toDateString(),
            ])
            ->assertStatus(404);

        $this->assertDatabaseCount('reservations', 0);
    }

    /**
     * RB-2: a start_date earlier than today is a validation error on
     * start_date (422) and writes nothing; today itself is accepted.
     *
     * @return array{0: \App\Models\User, 1: \App\Models\StoreRooms}
     */
    private function bookableRoomWithTenant(): array
    {
        $user = User::factory()->create();
        Tenants::factory()->create(['user_id' => $user->id]);
        $room = StoreRooms::factory()->approved()->create();
        StorePrices::factory()->create([
            'store_room_id' => $room->id,
            'mode' => 'month',
            'price' => 1000,
            'disponibility' => true,
        ]);

        return [$user, $room];
    }

    /** @test */
    public function a_start_date_before_today_is_rejected_with_422_on_start_date()
    {
        [$user, $room] = $this->bookableRoomWithTenant();

        $response = $this->actingAs($user, 'sanctum')
            ->postJson('/api/reservations', [
                'store_room_id' => $room->id,
                'start_date' => today()->subDay()->toDateString(),
                'end_date' => today()->addDays(10)->toDateString(),
            ]);

        $response->assertStatus(422)->assertJsonValidationErrors('start_date');
        $this->assertSame(
            'La fecha de inicio no puede ser anterior a hoy (fecha del servidor, UTC).',
            $response->json('errors.start_date.0')
        );
        $this->assertDatabaseCount('reservations', 0);
    }

    /** @test */
    public function a_start_date_of_today_is_accepted()
    {
        [$user, $room] = $this->bookableRoomWithTenant();

        $this->actingAs($user, 'sanctum')
            ->postJson('/api/reservations', [
                'store_room_id' => $room->id,
                'start_date' => today()->toDateString(),
                'end_date' => today()->addDays(10)->toDateString(),
            ])
            ->assertStatus(201);

        $this->assertDatabaseCount('reservations', 1);
    }

    /** @test */
    public function a_single_day_reservation_starting_and_ending_today_is_accepted()
    {
        [$user, $room] = $this->bookableRoomWithTenant();

        $this->actingAs($user, 'sanctum')
            ->postJson('/api/reservations', [
                'store_room_id' => $room->id,
                'start_date' => today()->toDateString(),
                'end_date' => today()->toDateString(),
            ])
            ->assertStatus(201);
    }

    /**
     * An id that does not exist keeps failing validation (422); only a room
     * that exists but is not approved is a 404.
     */
    /** @test */
    public function booking_a_nonexistent_room_keeps_returning_422()
    {
        $user = User::factory()->create();
        Tenants::factory()->create(['user_id' => $user->id]);

        $this->actingAs($user, 'sanctum')
            ->postJson('/api/reservations', [
                'store_room_id' => 999999,
                'start_date' => today()->addDays(5)->toDateString(),
                'end_date' => today()->addDays(10)->toDateString(),
            ])
            ->assertStatus(422)
            ->assertJsonValidationErrors('store_room_id');
    }

    /**
     * Old landlord-triggered confirm surface no longer exists: payment is
     * now the only path to `confirmed`.
     */
    /** @test */
    public function old_status_route_no_longer_exists()
    {
        $landlordUser = User::factory()->create(['role' => 'landlord']);
        $reservation = Reservations::factory()->create(['status' => 'pending']);

        $response = $this->actingAs($landlordUser, 'sanctum')
            ->patchJson("/api/landlord/reservations/{$reservation->id}/status", [
                'status' => 'confirmed',
            ]);

        $response->assertStatus(404);
    }

    /**
     * Regression guard: reservedDates() queries `reservations` by
     * store_room_id, a table StoreRooms's SoftDeletingScope never reaches.
     * The endpoint resolves the room through findOrFail() first precisely so
     * a soft-deleted storeroom yields a 404 instead of leaking the date
     * ranges of its surviving past reservations. Replacing findOrFail() with
     * a bare query would silently reintroduce that leak.
     */
    /** @test */
    public function reserved_dates_returns_404_for_a_soft_deleted_store_room()
    {
        $user = User::factory()->create();
        $room = StoreRooms::factory()->approved()->create();
        Reservations::factory()->create([
            'store_room_id' => $room->id,
            'status' => 'confirmed',
            'start_date' => today()->subDays(60)->toDateString(),
            'end_date' => today()->subDays(30)->toDateString(),
        ]);

        $this->actingAs($user, 'sanctum')
            ->getJson("/api/storeRooms/{$room->id}/reserved-dates")
            ->assertStatus(200)
            ->assertJsonCount(1);

        $room->delete();

        $this->actingAs($user, 'sanctum')
            ->getJson("/api/storeRooms/{$room->id}/reserved-dates")
            ->assertStatus(404);
    }

    /**
     * Obs #261: reservedDates() must union confirmed reservations with
     * StoreDisponibility blocks, sorted by start_date, keeping the bare
     * `[{start_date,end_date}]` shape (no origin/type/source key) so the
     * sole frontend consumer needs zero changes this cycle.
     */
    public function test_reserved_dates_unions_confirmed_reservations_and_blocks()
    {
        $user = User::factory()->create();
        $room = StoreRooms::factory()->approved()->create();

        Reservations::factory()->create([
            'store_room_id' => $room->id,
            'status' => 'confirmed',
            'start_date' => '2026-10-01',
            'end_date' => '2026-10-10',
        ]);

        StoreDisponibility::create([
            'store_room_id' => $room->id,
            'start_date' => '2026-11-01',
            'end_date' => '2026-11-05',
        ]);

        $response = $this->actingAs($user, 'sanctum')
            ->getJson("/api/storeRooms/{$room->id}/reserved-dates");

        $response->assertStatus(200);
        $response->assertJsonCount(2);
        $response->assertJson([
            ['start_date' => '2026-10-01', 'end_date' => '2026-10-10'],
            ['start_date' => '2026-11-01', 'end_date' => '2026-11-05'],
        ]);
        $response->assertJsonMissingPath('0.origin');
        $response->assertJsonMissingPath('0.type');
    }

    /**
     * sdd/hug02-payment-hold-expiry: a second tenant's create() request
     * must be rejected with 409, identically to a confirmed conflict, when
     * another tenant holds an active (non-expired) pending reservation on
     * overlapping dates.
     */
    public function test_create_returns_409_when_another_tenants_hold_is_active()
    {
        $room = StoreRooms::factory()->approved()->create();
        StorePrices::factory()->create([
            'store_room_id' => $room->id,
            'mode' => 'month',
            'price' => 1000,
            'disponibility' => true,
        ]);

        $userA = User::factory()->create();
        Tenants::factory()->create(['user_id' => $userA->id]);
        $this->actingAs($userA, 'sanctum')->postJson('/api/reservations', [
            'store_room_id' => $room->id,
            'start_date' => today()->addDays(30)->toDateString(),
            'end_date' => today()->addDays(39)->toDateString(),
        ])->assertStatus(201);

        $userB = User::factory()->create();
        Tenants::factory()->create(['user_id' => $userB->id]);

        $response = $this->actingAs($userB, 'sanctum')->postJson('/api/reservations', [
            'store_room_id' => $room->id,
            'start_date' => today()->addDays(34)->toDateString(),
            'end_date' => today()->addDays(44)->toDateString(),
        ]);

        $response->assertStatus(409);
    }

    /**
     * sdd/hug02-payment-hold-expiry: once the first tenant's hold has
     * elapsed, a second tenant's overlapping request must succeed.
     */
    public function test_create_succeeds_after_the_blocking_hold_expires()
    {
        $room = StoreRooms::factory()->approved()->create();
        StorePrices::factory()->create([
            'store_room_id' => $room->id,
            'mode' => 'month',
            'price' => 1000,
            'disponibility' => true,
        ]);

        $userA = User::factory()->create();
        Tenants::factory()->create(['user_id' => $userA->id]);

        config(['reservations.payment_hold_minutes' => 15]);
        Carbon::setTestNow(now()->subMinutes(20));
        $this->actingAs($userA, 'sanctum')->postJson('/api/reservations', [
            'store_room_id' => $room->id,
            'start_date' => today()->addDays(30)->toDateString(),
            'end_date' => today()->addDays(39)->toDateString(),
        ])->assertStatus(201);
        Carbon::setTestNow();

        $userB = User::factory()->create();
        Tenants::factory()->create(['user_id' => $userB->id]);

        $response = $this->actingAs($userB, 'sanctum')->postJson('/api/reservations', [
            'store_room_id' => $room->id,
            'start_date' => today()->addDays(34)->toDateString(),
            'end_date' => today()->addDays(44)->toDateString(),
        ]);

        $response->assertStatus(201);
    }

    /**
     * sdd/hug02-payment-hold-expiry (orchestrator correction): reservedDates()
     * must exclude the AUTHENTICATED CALLER'S OWN active hold when the
     * caller resolves to a tenant, via $request->user() (never auth()).
     */
    public function test_reserved_dates_excludes_the_tenant_callers_own_active_hold()
    {
        $room = StoreRooms::factory()->approved()->create();
        $userA = User::factory()->create();
        $tenantA = Tenants::factory()->create(['user_id' => $userA->id]);

        Reservations::factory()->create([
            'store_room_id' => $room->id,
            'tenant_id' => $tenantA->id,
            'status' => 'pending',
            'start_date' => '2026-09-01',
            'end_date' => '2026-09-10',
        ]);

        $response = $this->actingAs($userA, 'sanctum')
            ->getJson("/api/storeRooms/{$room->id}/reserved-dates");

        $response->assertStatus(200)->assertJsonCount(0);
    }

    public function test_reserved_dates_includes_another_tenants_active_hold()
    {
        $room = StoreRooms::factory()->approved()->create();
        $userA = User::factory()->create();
        $tenantA = Tenants::factory()->create(['user_id' => $userA->id]);
        $userB = User::factory()->create();
        Tenants::factory()->create(['user_id' => $userB->id]);

        Reservations::factory()->create([
            'store_room_id' => $room->id,
            'tenant_id' => $tenantA->id,
            'status' => 'pending',
            'start_date' => '2026-09-01',
            'end_date' => '2026-09-10',
        ]);

        $response = $this->actingAs($userB, 'sanctum')
            ->getJson("/api/storeRooms/{$room->id}/reserved-dates");

        $response->assertStatus(200)->assertJsonCount(1);
    }

    public function test_reserved_dates_shows_all_active_holds_to_a_landlord_caller_with_no_self_exclusion()
    {
        $room = StoreRooms::factory()->approved()->create();
        $tenant = Tenants::factory()->create();
        $landlordUser = User::factory()->create(['role' => 'landlord']);

        Reservations::factory()->create([
            'store_room_id' => $room->id,
            'tenant_id' => $tenant->id,
            'status' => 'pending',
            'start_date' => '2026-09-01',
            'end_date' => '2026-09-10',
        ]);

        $response = $this->actingAs($landlordUser, 'sanctum')
            ->getJson("/api/storeRooms/{$room->id}/reserved-dates");

        $response->assertStatus(200)->assertJsonCount(1);
    }

    public function test_reserved_dates_still_404s_for_nonexistent_store_room()
    {
        $user = User::factory()->create();

        $this->actingAs($user, 'sanctum')
            ->getJson('/api/storeRooms/999999/reserved-dates')
            ->assertStatus(404);
    }

    /**
     * RB-3: reserved-dates is public. A visitor (no session) gets the date
     * ranges of an approved room - confirmed reservations and active holds -
     * and nothing that identifies a tenant.
     */
    public function test_visitor_gets_confirmed_and_hold_ranges_of_an_approved_room_without_tenant_data()
    {
        $room = StoreRooms::factory()->approved()->create();
        $tenant = Tenants::factory()->create();

        Reservations::factory()->create([
            'store_room_id' => $room->id,
            'tenant_id' => $tenant->id,
            'status' => 'confirmed',
            'start_date' => today()->addDays(10)->toDateString(),
            'end_date' => today()->addDays(15)->toDateString(),
        ]);
        Reservations::factory()->create([
            'store_room_id' => $room->id,
            'tenant_id' => $tenant->id,
            'status' => 'pending',
            'start_date' => today()->addDays(20)->toDateString(),
            'end_date' => today()->addDays(25)->toDateString(),
        ]);

        $response = $this->getJson("/api/storeRooms/{$room->id}/reserved-dates");

        $response->assertStatus(200)->assertJsonCount(2);
        $response->assertExactJson([
            [
                'start_date' => today()->addDays(10)->toDateString(),
                'end_date' => today()->addDays(15)->toDateString(),
            ],
            [
                'start_date' => today()->addDays(20)->toDateString(),
                'end_date' => today()->addDays(25)->toDateString(),
            ],
        ]);
    }

    public function test_visitor_sees_every_active_hold_with_no_self_exclusion()
    {
        $room = StoreRooms::factory()->approved()->create();

        foreach ([0, 1] as $i) {
            Reservations::factory()->create([
                'store_room_id' => $room->id,
                'tenant_id' => Tenants::factory()->create()->id,
                'status' => 'pending',
                'start_date' => today()->addDays(10 + $i * 10)->toDateString(),
                'end_date' => today()->addDays(15 + $i * 10)->toDateString(),
            ]);
        }

        $this->getJson("/api/storeRooms/{$room->id}/reserved-dates")
            ->assertStatus(200)
            ->assertJsonCount(2);
    }

    public function test_visitor_gets_404_on_reserved_dates_of_a_pending_room()
    {
        $room = StoreRooms::factory()->create(['publication_status' => 'pending']);
        Reservations::factory()->create([
            'store_room_id' => $room->id,
            'status' => 'confirmed',
            'start_date' => today()->addDays(10)->toDateString(),
            'end_date' => today()->addDays(15)->toDateString(),
        ]);

        $this->getJson("/api/storeRooms/{$room->id}/reserved-dates")->assertStatus(404);
    }

    public function test_tenant_gets_404_on_reserved_dates_of_a_rejected_room()
    {
        $room = StoreRooms::factory()->create(['publication_status' => 'rejected']);
        $user = User::factory()->create();
        Tenants::factory()->create(['user_id' => $user->id]);

        $this->actingAs($user, 'sanctum')
            ->getJson("/api/storeRooms/{$room->id}/reserved-dates")
            ->assertStatus(404);
    }

    public function test_owning_landlord_gets_200_on_reserved_dates_of_a_pending_room()
    {
        $ownerUser = User::factory()->create(['role' => 'landlord']);
        $landlord = Landlords::factory()->create(['user_id' => $ownerUser->id]);
        $room = StoreRooms::factory()->create([
            'landlord_id' => $landlord->id,
            'publication_status' => 'pending',
        ]);
        Reservations::factory()->create([
            'store_room_id' => $room->id,
            'status' => 'confirmed',
            'start_date' => today()->addDays(10)->toDateString(),
            'end_date' => today()->addDays(15)->toDateString(),
        ]);

        $this->actingAs($ownerUser, 'sanctum')
            ->getJson("/api/storeRooms/{$room->id}/reserved-dates")
            ->assertStatus(200)
            ->assertJsonCount(1);
    }

    public function test_another_landlord_gets_404_on_reserved_dates_of_a_pending_room()
    {
        $room = StoreRooms::factory()->create(['publication_status' => 'pending']);
        $otherUser = User::factory()->create(['role' => 'landlord']);
        Landlords::factory()->create(['user_id' => $otherUser->id]);

        $this->actingAs($otherUser, 'sanctum')
            ->getJson("/api/storeRooms/{$room->id}/reserved-dates")
            ->assertStatus(404);
    }

    public function test_admin_gets_200_on_reserved_dates_of_a_pending_room()
    {
        $room = StoreRooms::factory()->create(['publication_status' => 'pending']);
        $admin = User::factory()->create(['role' => 'admin']);

        $this->actingAs($admin, 'sanctum')
            ->getJson("/api/storeRooms/{$room->id}/reserved-dates")
            ->assertStatus(200);
    }

    public function test_visitor_gets_404_on_reserved_dates_of_a_soft_deleted_room()
    {
        $room = StoreRooms::factory()->approved()->create();
        $room->delete();

        $this->getJson("/api/storeRooms/{$room->id}/reserved-dates")->assertStatus(404);
    }

    /**
     * The visibility check runs before the lazy hold sweep, so a hidden room
     * is a pure 404 with no write side effect for an anonymous caller.
     */
    public function test_a_hidden_room_404_does_not_sweep_its_expired_holds()
    {
        $room = StoreRooms::factory()->create(['publication_status' => 'pending']);
        $hold = Reservations::factory()->create([
            'store_room_id' => $room->id,
            'status' => 'pending',
            'created_at' => now()->subDay(),
        ]);

        $this->getJson("/api/storeRooms/{$room->id}/reserved-dates")->assertStatus(404);

        $this->assertSame('pending', $hold->fresh()->status);
    }

    /**
     * RB-1 "Service unaffected": the publication guard is a controller
     * concern. The service itself still books a pending room.
     */
    public function test_the_service_does_not_reject_a_pending_room()
    {
        $room = StoreRooms::factory()->create(['publication_status' => 'pending']);
        StorePrices::factory()->create([
            'store_room_id' => $room->id,
            'mode' => 'month',
            'price' => 1000,
            'disponibility' => true,
        ]);
        $user = User::factory()->create();
        $tenant = Tenants::factory()->create(['user_id' => $user->id]);

        $reservation = app(ReservationService::class)->create($tenant, $room, [
            'store_room_id' => $room->id,
            'start_date' => today()->addDays(5)->toDateString(),
            'end_date' => today()->addDays(10)->toDateString(),
        ], $user->id);

        $this->assertSame('pending', $reservation->status);
        $this->assertDatabaseCount('reservations', 1);
    }
}
