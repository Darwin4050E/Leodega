<?php

namespace Tests\Feature;

use App\Models\Landlords;
use App\Models\Payments;
use App\Models\Reservations;
use App\Models\StorePhoto;
use App\Models\StoreRooms;
use App\Models\Tenants;
use App\Models\User;
use App\Support\ReservationCode;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

/**
 * sdd/tenant-reservations-screen: tenantIndex() gains two server-computed
 * fields mirroring landlordIndex()'s established idiom -- can_be_cancelled
 * (Reservations::isCancellableByTenant()) and photo_url (a directly-usable
 * asset() URL, not the bare storage-relative path).
 */
class TenantReservationIndexTest extends TestCase
{
    use RefreshDatabase;

    private function tenant(): array
    {
        $user = User::factory()->create();
        $tenant = Tenants::factory()->create(['user_id' => $user->id]);

        return [$user, $tenant];
    }

    public function test_can_be_cancelled_is_true_for_an_eligible_reservation()
    {
        [$user, $tenant] = $this->tenant();
        $room = StoreRooms::factory()->create();

        $reservation = Reservations::factory()->create([
            'store_room_id' => $room->id,
            'tenant_id' => $tenant->id,
            'status' => 'confirmed',
            'start_date' => today()->addDays(5)->toDateString(),
            'end_date' => today()->addDays(35)->toDateString(),
        ]);

        $response = $this->actingAs($user, 'sanctum')->getJson('/api/tenant/reservations');

        $item = collect($response->json())->firstWhere('id', $reservation->id);
        $this->assertTrue($item['can_be_cancelled']);
    }

    public function test_can_be_cancelled_is_false_once_the_reservation_started()
    {
        [$user, $tenant] = $this->tenant();
        $room = StoreRooms::factory()->create();

        $reservation = Reservations::factory()->create([
            'store_room_id' => $room->id,
            'tenant_id' => $tenant->id,
            'status' => 'confirmed',
            'start_date' => today()->toDateString(),
            'end_date' => today()->addDays(30)->toDateString(),
        ]);

        $response = $this->actingAs($user, 'sanctum')->getJson('/api/tenant/reservations');

        $item = collect($response->json())->firstWhere('id', $reservation->id);
        $this->assertFalse($item['can_be_cancelled']);
    }

    /**
     * Uses App\Models\StoreRooms::storePhotos() (verified StoreRooms.php:49),
     * NOT a non-existent photos() relation, and applies the same
     * asset('storage/'.$p->photo_url) transform as
     * StoreRoomDetailResource::toArray() (StoreRoomDetailResource.php:53) --
     * a bare relation exposure would ship an unusable storage-relative path.
     */
    public function test_photo_url_is_a_directly_usable_asset_url()
    {
        [$user, $tenant] = $this->tenant();
        $room = StoreRooms::factory()->create();
        StorePhoto::create([
            'store_room_id' => $room->id,
            'photo_url' => 'store_photos/example.jpg',
        ]);

        $reservation = Reservations::factory()->create([
            'store_room_id' => $room->id,
            'tenant_id' => $tenant->id,
            'status' => 'confirmed',
            'start_date' => today()->addDays(5)->toDateString(),
            'end_date' => today()->addDays(35)->toDateString(),
        ]);

        $response = $this->actingAs($user, 'sanctum')->getJson('/api/tenant/reservations');

        $item = collect($response->json())->firstWhere('id', $reservation->id);
        $this->assertSame(asset('storage/store_photos/example.jpg'), $item['photo_url']);
    }

    public function test_photo_url_is_null_when_the_storeroom_has_no_photo()
    {
        [$user, $tenant] = $this->tenant();
        $room = StoreRooms::factory()->create();

        $reservation = Reservations::factory()->create([
            'store_room_id' => $room->id,
            'tenant_id' => $tenant->id,
            'status' => 'confirmed',
            'start_date' => today()->addDays(5)->toDateString(),
            'end_date' => today()->addDays(35)->toDateString(),
        ]);

        $response = $this->actingAs($user, 'sanctum')->getJson('/api/tenant/reservations');

        $item = collect($response->json())->firstWhere('id', $reservation->id);
        $this->assertNull($item['photo_url']);
    }

    /**
     * sdd/hug02-payment-hold-expiry: tenantIndex() must trigger the lazy
     * expiry sweep before querying, so the tenant's own elapsed hold shows
     * as canceled without a separate request.
     */
    public function test_tenant_index_triggers_sweep_and_shows_expired_hold_as_canceled()
    {
        [$user, $tenant] = $this->tenant();
        $room = StoreRooms::factory()->create();

        config(['reservations.payment_hold_minutes' => 15]);
        $reservation = Reservations::factory()->create([
            'store_room_id' => $room->id,
            'tenant_id' => $tenant->id,
            'status' => 'pending',
            'created_at' => now()->subMinutes(20),
        ]);

        $response = $this->actingAs($user, 'sanctum')->getJson('/api/tenant/reservations');

        $response->assertStatus(200);
        $item = collect($response->json())->firstWhere('id', $reservation->id);
        $this->assertSame('canceled', $item['status']);
    }

    private function paidReservation(Tenants $tenant, array $overrides = []): Reservations
    {
        $gestor = User::factory()->create(['name' => 'Ana', 'lastname' => 'Pérez', 'role' => 'landlord']);
        $landlord = Landlords::factory()->create(['user_id' => $gestor->id]);
        $room = StoreRooms::factory()->create(['landlord_id' => $landlord->id]);

        return Reservations::factory()->create(array_merge([
            'store_room_id' => $room->id,
            'tenant_id' => $tenant->id,
            'status' => 'confirmed',
            'start_date' => today()->addDays(5)->toDateString(),
            'end_date' => today()->addDays(35)->toDateString(),
        ], $overrides));
    }

    private function payment(Reservations $reservation, string $state, string $method = 'credit card'): Payments
    {
        return Payments::factory()->create([
            'reservation_id' => $reservation->id,
            'payment_state' => $state,
            'payment_method' => $method,
        ]);
    }

    public function test_confirmed_paid_reservation_carries_the_nested_receipt_with_the_latest_paid_row()
    {
        [$user, $tenant] = $this->tenant();
        $reservation = $this->paidReservation($tenant);
        $paid = $this->payment($reservation, 'paid', 'debit card');
        $this->payment($reservation, 'failed', 'credit card');

        $response = $this->actingAs($user, 'sanctum')->getJson('/api/tenant/reservations');

        $item = collect($response->json())->firstWhere('id', $reservation->id);
        $this->assertSame('Ana Pérez', $item['receipt']['gestor_name']);
        $this->assertSame($paid->id, $item['receipt']['payment_id']);
        $this->assertSame('debit card', $item['receipt']['payment_method']);
        $this->assertSame('CONFIRMADA', $item['receipt']['status_label']);
        $this->assertSame(ReservationCode::format($reservation->id), $item['receipt']['code']);
    }

    public function test_receipt_is_null_for_pending_canceled_and_unpaid_confirmed_reservations()
    {
        [$user, $tenant] = $this->tenant();
        $pending = $this->paidReservation($tenant, ['status' => 'pending']);
        $this->payment($pending, 'paid');
        $canceled = $this->paidReservation($tenant, ['status' => 'canceled']);
        $this->payment($canceled, 'paid');
        $unpaid = $this->paidReservation($tenant);
        $this->payment($unpaid, 'pending');

        $items = collect($this->actingAs($user, 'sanctum')->getJson('/api/tenant/reservations')->json());

        $this->assertCount(3, $items);
        foreach ([$pending, $canceled, $unpaid] as $reservation) {
            $item = $items->firstWhere('id', $reservation->id);
            $this->assertArrayHasKey('receipt', $item);
            $this->assertNull($item['receipt']);
        }
    }

    public function test_response_does_not_leak_payments_or_the_landlord_user()
    {
        [$user, $tenant] = $this->tenant();
        $reservation = $this->paidReservation($tenant, ['refund_amount' => 25]);
        $this->payment($reservation, 'paid');
        StorePhoto::create(['store_room_id' => $reservation->store_room_id, 'photo_url' => 'store_photos/example.jpg']);

        $response = $this->actingAs($user, 'sanctum')->getJson('/api/tenant/reservations');

        $item = collect($response->json())->firstWhere('id', $reservation->id);
        $this->assertArrayNotHasKey('payments', $item);
        $this->assertArrayNotHasKey('landlord', $item['store_rooms']);
        $this->assertArrayNotHasKey('store_photos', $item['store_rooms']);
        $this->assertStringNotContainsString('lastname', json_encode($item));
        $this->assertTrue($item['can_be_cancelled']);
        $this->assertSame(asset('storage/store_photos/example.jpg'), $item['photo_url']);
        $this->assertEquals(25, $item['refund_amount']);
        $this->assertSame('Ana Pérez', $item['receipt']['gestor_name']);
    }

    public function test_a_tenant_never_sees_another_tenants_rows_or_payment_data()
    {
        [, $tenantA] = $this->tenant();
        $reservationA = $this->paidReservation($tenantA);
        $paymentA = $this->payment($reservationA, 'paid');
        [$userB, $tenantB] = $this->tenant();
        $reservationB = $this->paidReservation($tenantB);

        $items = collect($this->actingAs($userB, 'sanctum')->getJson('/api/tenant/reservations')->json());

        $this->assertSame([$reservationB->id], $items->pluck('id')->all());
        $this->assertNull($items->first()['receipt']);
        $this->assertStringNotContainsString('"payment_id":'.$paymentA->id, json_encode($items));
    }

    private function indexQueryCount(User $user): int
    {
        DB::flushQueryLog();
        DB::enableQueryLog();

        try {
            $this->actingAs($user, 'sanctum')->getJson('/api/tenant/reservations')->assertStatus(200);

            return count(DB::getQueryLog());
        } finally {
            DB::disableQueryLog();
        }
    }

    public function test_index_query_count_does_not_grow_with_the_number_of_reservations()
    {
        [$user, $tenant] = $this->tenant();
        foreach ([1, 2] as $_) {
            $this->payment($this->paidReservation($tenant), 'paid');
        }
        $withTwo = $this->indexQueryCount($user);

        foreach ([1, 2, 3] as $_) {
            $this->payment($this->paidReservation($tenant), 'paid');
        }

        $this->assertSame($withTwo, $this->indexQueryCount($user));
    }
}
