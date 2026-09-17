<?php

namespace Tests\Feature;

use App\Models\Landlords;
use App\Models\Reservations;
use App\Models\StoreRooms;
use App\Models\Tenants;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class TenantReservationCancellationTest extends TestCase
{
    use RefreshDatabase;

    private function reservationFor(Tenants $tenant, array $overrides = []): Reservations
    {
        $room = StoreRooms::factory()->create();

        return Reservations::factory()->create(array_merge([
            'store_room_id' => $room->id,
            'tenant_id' => $tenant->id,
            'status' => 'confirmed',
            'start_date' => now()->addDays(10)->toDateString(),
            'end_date' => now()->addDays(20)->toDateString(),
            'total_mount' => 100,
            'rent_subtotal' => 80,
            'cancellation_policy_tier' => 'flexible',
        ], $overrides));
    }

    public function test_owning_tenant_can_cancel_with_a_reason()
    {
        $tenantUser = User::factory()->create();
        $tenant = Tenants::factory()->create(['user_id' => $tenantUser->id]);
        $reservation = $this->reservationFor($tenant);

        $response = $this->actingAs($tenantUser, 'sanctum')
            ->patchJson("/api/tenant/reservations/{$reservation->id}/cancel", [
                'reason' => 'Ya no necesito la bodega',
            ]);

        $response->assertStatus(200);
        $this->assertDatabaseHas('reservations', [
            'id' => $reservation->id,
            'status' => 'canceled',
            'refund_amount' => '100.00',
        ]);
    }

    public function test_owning_tenant_can_cancel_without_a_reason()
    {
        $tenantUser = User::factory()->create();
        $tenant = Tenants::factory()->create(['user_id' => $tenantUser->id]);
        $reservation = $this->reservationFor($tenant);

        $response = $this->actingAs($tenantUser, 'sanctum')
            ->patchJson("/api/tenant/reservations/{$reservation->id}/cancel", []);

        $response->assertStatus(200);
        $this->assertDatabaseHas('reservations', ['id' => $reservation->id, 'status' => 'canceled']);
    }

    public function test_non_owning_tenant_is_forbidden()
    {
        $tenant = Tenants::factory()->create();
        $reservation = $this->reservationFor($tenant);

        $intruderUser = User::factory()->create();
        Tenants::factory()->create(['user_id' => $intruderUser->id]);

        $response = $this->actingAs($intruderUser, 'sanctum')
            ->patchJson("/api/tenant/reservations/{$reservation->id}/cancel", []);

        $response->assertStatus(403);
        $this->assertDatabaseHas('reservations', ['id' => $reservation->id, 'status' => 'confirmed']);
    }

    public function test_landlord_is_forbidden()
    {
        $tenant = Tenants::factory()->create();
        $reservation = $this->reservationFor($tenant);

        $landlordUser = User::factory()->create(['role' => 'landlord']);
        Landlords::factory()->create(['user_id' => $landlordUser->id]);

        $response = $this->actingAs($landlordUser, 'sanctum')
            ->patchJson("/api/tenant/reservations/{$reservation->id}/cancel", []);

        $response->assertStatus(403);
    }

    public function test_unauthenticated_request_is_rejected()
    {
        $tenant = Tenants::factory()->create();
        $reservation = $this->reservationFor($tenant);

        $response = $this->patchJson("/api/tenant/reservations/{$reservation->id}/cancel", []);

        $response->assertStatus(401);
        $this->assertDatabaseHas('reservations', ['id' => $reservation->id, 'status' => 'confirmed']);
    }

    public function test_already_canceled_reservation_returns_409()
    {
        $tenantUser = User::factory()->create();
        $tenant = Tenants::factory()->create(['user_id' => $tenantUser->id]);
        $reservation = $this->reservationFor($tenant, ['status' => 'canceled']);

        $response = $this->actingAs($tenantUser, 'sanctum')
            ->patchJson("/api/tenant/reservations/{$reservation->id}/cancel", []);

        $response->assertStatus(409);
    }

    public function test_reservation_starting_today_returns_409()
    {
        $tenantUser = User::factory()->create();
        $tenant = Tenants::factory()->create(['user_id' => $tenantUser->id]);
        $reservation = $this->reservationFor($tenant, [
            'start_date' => today()->toDateString(),
            'end_date' => today()->addDays(10)->toDateString(),
        ]);

        $response = $this->actingAs($tenantUser, 'sanctum')
            ->patchJson("/api/tenant/reservations/{$reservation->id}/cancel", []);

        $response->assertStatus(409);
    }

    public function test_reservation_already_started_returns_409()
    {
        $tenantUser = User::factory()->create();
        $tenant = Tenants::factory()->create(['user_id' => $tenantUser->id]);
        $reservation = $this->reservationFor($tenant, [
            'start_date' => today()->subDays(2)->toDateString(),
            'end_date' => today()->addDays(10)->toDateString(),
        ]);

        $response = $this->actingAs($tenantUser, 'sanctum')
            ->patchJson("/api/tenant/reservations/{$reservation->id}/cancel", []);

        $response->assertStatus(409);
    }

    public function test_canceled_reservation_dates_are_excluded_from_reserved_dates()
    {
        $tenantUser = User::factory()->create();
        $tenant = Tenants::factory()->create(['user_id' => $tenantUser->id]);
        $reservation = $this->reservationFor($tenant);
        $roomId = $reservation->store_room_id;

        $this->actingAs($tenantUser, 'sanctum')
            ->patchJson("/api/tenant/reservations/{$reservation->id}/cancel", [])
            ->assertStatus(200);

        $response = $this->getJson("/api/storeRooms/{$roomId}/reserved-dates");

        $response->assertStatus(200);
        $response->assertJsonMissing(['start_date' => $reservation->start_date]);
    }
}
