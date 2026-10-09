<?php

namespace Tests\Feature;

use App\Enums\OrganizationRole;
use App\Models\Landlords;
use App\Models\Organization;
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

    // -- HUE-05 U1b: organization-reservations listing (OR-6, OR-7, OR-9) --

    private function organizationFor(User $user, OrganizationRole $role = OrganizationRole::ADMIN): Organization
    {
        return Organization::factory()->withMember($user, $role)->create();
    }

    /**
     * OR-S4/OR-S12: without a header, only the caller's own reservations
     * with organization_id IS NULL come back -- an org reservation of the
     * SAME tenant must be excluded.
     */
    public function test_personal_list_excludes_the_callers_own_organization_reservations()
    {
        [$user, $tenant] = $this->tenant();
        $organization = $this->organizationFor($user);
        $room = StoreRooms::factory()->create();

        $personal = Reservations::factory()->create([
            'store_room_id' => $room->id,
            'tenant_id' => $tenant->id,
            'organization_id' => null,
        ]);
        Reservations::factory()->forOrganization($organization)->create([
            'store_room_id' => $room->id,
            'tenant_id' => $tenant->id,
        ]);

        $items = collect($this->actingAs($user, 'sanctum')->getJson('/api/tenant/reservations')->json());

        $this->assertSame([$personal->id], $items->pluck('id')->all());
    }

    /**
     * OR-S13/OR-S14: with a valid header, every member's reservation in that
     * org comes back (not only the caller's), each carrying the creator's
     * name -- and personal/other-org reservations are excluded.
     */
    public function test_org_context_list_returns_every_members_reservation_with_creator_name()
    {
        $admin = User::factory()->create(['role' => 'tenant', 'name' => 'Ana', 'lastname' => 'Reyes']);
        $adminTenant = Tenants::factory()->create(['user_id' => $admin->id]);
        $member = User::factory()->create(['role' => 'tenant', 'name' => 'Luis', 'lastname' => 'Paz']);
        $memberTenant = Tenants::factory()->create(['user_id' => $member->id]);
        $organization = Organization::factory()
            ->withMember($admin, OrganizationRole::ADMIN)
            ->withMember($member, OrganizationRole::MEMBER)
            ->create();
        $otherOrganization = $this->organizationFor($admin);
        $room = StoreRooms::factory()->create();

        $byAdmin = Reservations::factory()->forOrganization($organization)->create([
            'store_room_id' => $room->id,
            'tenant_id' => $adminTenant->id,
        ]);
        $byMember = Reservations::factory()->forOrganization($organization)->create([
            'store_room_id' => $room->id,
            'tenant_id' => $memberTenant->id,
        ]);
        Reservations::factory()->forOrganization($otherOrganization)->create([
            'store_room_id' => $room->id,
            'tenant_id' => $adminTenant->id,
        ]);
        Reservations::factory()->create([
            'store_room_id' => $room->id,
            'tenant_id' => $adminTenant->id,
            'organization_id' => null,
        ]);

        $response = $this->actingAs($member, 'sanctum')
            ->getJson('/api/tenant/reservations', ['X-Organization-Id' => (string) $organization->id]);

        $items = collect($response->json());
        $this->assertSame(
            [$byAdmin->id, $byMember->id],
            $items->pluck('id')->sort()->values()->all(),
        );
        $this->assertSame('Ana Reyes', $items->firstWhere('id', $byAdmin->id)['creator_name']);
        $this->assertSame('Luis Paz', $items->firstWhere('id', $byMember->id)['creator_name']);
    }

    public function test_org_context_returns_an_empty_list_when_the_org_has_no_reservations()
    {
        $user = User::factory()->create(['role' => 'tenant']);
        Tenants::factory()->create(['user_id' => $user->id]);
        $organization = $this->organizationFor($user);

        $response = $this->actingAs($user, 'sanctum')
            ->getJson('/api/tenant/reservations', ['X-Organization-Id' => (string) $organization->id]);

        $response->assertStatus(200);
        $this->assertSame([], $response->json());
    }

    /**
     * OR-S16: is_creator reflects whether the CALLER authored the row, not
     * whether anyone did.
     */
    public function test_is_creator_is_true_for_the_authors_row_and_false_for_another_members()
    {
        [$author, $authorTenant] = $this->tenant();
        $viewer = User::factory()->create(['role' => 'tenant']);
        $viewerTenant = Tenants::factory()->create(['user_id' => $viewer->id]);
        $organization = Organization::factory()
            ->withMember($author, OrganizationRole::ADMIN)
            ->withMember($viewer, OrganizationRole::MEMBER)
            ->create();
        $room = StoreRooms::factory()->create();

        $reservation = Reservations::factory()->forOrganization($organization)->create([
            'store_room_id' => $room->id,
            'tenant_id' => $authorTenant->id,
        ]);

        $asAuthor = collect(
            $this->actingAs($author, 'sanctum')
                ->getJson('/api/tenant/reservations', ['X-Organization-Id' => (string) $organization->id])
                ->json()
        )->firstWhere('id', $reservation->id);
        $asViewer = collect(
            $this->actingAs($viewer, 'sanctum')
                ->getJson('/api/tenant/reservations', ['X-Organization-Id' => (string) $organization->id])
                ->json()
        )->firstWhere('id', $reservation->id);

        $this->assertTrue($asAuthor['is_creator']);
        $this->assertFalse($asViewer['is_creator']);
    }

    /**
     * D6/D13/D15: a non-creator member sees the row but gets no cancel
     * action and no receipt -- server-authoritative gating, not just a web
     * concern.
     */
    public function test_non_creator_gets_can_be_cancelled_false_and_null_receipt_even_if_eligible()
    {
        [$author, $authorTenant] = $this->tenant();
        $viewer = User::factory()->create(['role' => 'tenant']);
        Tenants::factory()->create(['user_id' => $viewer->id]);
        $organization = Organization::factory()
            ->withMember($author, OrganizationRole::ADMIN)
            ->withMember($viewer, OrganizationRole::MEMBER)
            ->create();
        $reservation = $this->paidReservation($authorTenant, ['organization_id' => $organization->id]);
        $this->payment($reservation, 'paid');

        $item = collect(
            $this->actingAs($viewer, 'sanctum')
                ->getJson('/api/tenant/reservations', ['X-Organization-Id' => (string) $organization->id])
                ->json()
        )->firstWhere('id', $reservation->id);

        $this->assertFalse($item['can_be_cancelled']);
        $this->assertNull($item['receipt']);
    }

    /**
     * OR-S9: a header the caller is not a member of must 403 before the
     * controller runs, on the real listing route (not just the probe).
     */
    public function test_a_stale_header_is_forbidden_on_the_real_listing_route()
    {
        [$user] = $this->tenant();
        $foreign = Organization::factory()->create();

        $response = $this->actingAs($user, 'sanctum')
            ->getJson('/api/tenant/reservations', ['X-Organization-Id' => (string) $foreign->id]);

        $response->assertStatus(403);
        $response->assertExactJson(['message' => 'No perteneces a la organización seleccionada']);
    }
}
