<?php

namespace Tests\Unit;

use App\Models\Landlords;
use App\Models\Reservations;
use App\Models\StoreRooms;
use App\Models\Tenants;
use App\Models\User;
use App\Policies\ReservationsPolicy;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * `cancelAsTenant()` mirrors the PaymentsPolicy::create ownership idiom
 * (`backend/app/Policies/PaymentsPolicy.php:16-21`): identity only, no
 * eligibility -- that belongs to ReservationService::cancelByTenant().
 */
class ReservationsPolicyCancelAsTenantTest extends TestCase
{
    use RefreshDatabase;

    public function test_owning_tenant_is_authorized()
    {
        $tenantUser = User::factory()->create();
        $tenant = Tenants::factory()->create(['user_id' => $tenantUser->id]);
        $room = StoreRooms::factory()->create();
        $reservation = Reservations::factory()->create([
            'store_room_id' => $room->id,
            'tenant_id' => $tenant->id,
        ]);

        $allowed = (new ReservationsPolicy)->cancelAsTenant($tenantUser, $reservation);

        $this->assertTrue($allowed);
    }

    public function test_a_different_tenant_is_not_authorized()
    {
        $tenant = Tenants::factory()->create();
        $room = StoreRooms::factory()->create();
        $reservation = Reservations::factory()->create([
            'store_room_id' => $room->id,
            'tenant_id' => $tenant->id,
        ]);

        $otherUser = User::factory()->create();
        Tenants::factory()->create(['user_id' => $otherUser->id]);

        $allowed = (new ReservationsPolicy)->cancelAsTenant($otherUser, $reservation);

        $this->assertFalse($allowed);
    }

    public function test_the_room_landlord_is_not_authorized()
    {
        $tenant = Tenants::factory()->create();
        $landlordUser = User::factory()->create(['role' => 'landlord']);
        $landlord = Landlords::factory()->create(['user_id' => $landlordUser->id]);
        $room = StoreRooms::factory()->create(['landlord_id' => $landlord->id]);
        $reservation = Reservations::factory()->create([
            'store_room_id' => $room->id,
            'tenant_id' => $tenant->id,
        ]);

        $allowed = (new ReservationsPolicy)->cancelAsTenant($landlordUser, $reservation);

        $this->assertFalse($allowed);
    }
}
