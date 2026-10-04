<?php

namespace Tests\Feature;

use App\Models\Reservations;
use App\Models\StoreRooms;
use App\Models\Tenants;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * sdd/tenant-reservations-screen, design decision #1 (load-bearing test):
 * proves the refund shown by GET .../cancellation-preview is byte-identical
 * to the amount PATCH .../cancel actually records, because both call the
 * exact same private ReservationService::computeRefund() -- never two
 * independently-maintained calculations that could drift.
 *
 * Carbon::setTestNow() freezes "today" for the whole test so the same
 * daysBeforeStart applies to both calls; the data provider reuses
 * CancellationRefundCalculatorTest's tier boundary matrix (flexible/
 * moderada/estricta, at and around each threshold).
 */
class TenantCancellationPreviewEquivalenceTest extends TestCase
{
    use RefreshDatabase;

    protected function tearDown(): void
    {
        Carbon::setTestNow();
        parent::tearDown();
    }

    /**
     * daysBeforeStart values only cover the strictly-future range: a
     * reservation with start_date <= today is never cancellable
     * (Reservations::isCancellableByTenant()), so the calculator's own
     * "0 days before" bucket is unreachable through this endpoint pair and
     * is intentionally excluded here (it is already covered directly by
     * CancellationRefundCalculatorTest).
     */
    public static function tierBoundaryProvider(): array
    {
        return [
            'flexible at 1 day before (full refund)' => ['flexible', 1],
            'flexible at 2 days before (still full refund)' => ['flexible', 2],
            'moderada at 7 days before (full refund)' => ['moderada', 7],
            'moderada at 6 days before (half refund)' => ['moderada', 6],
            'moderada at 1 day before (half refund)' => ['moderada', 1],
            'estricta at 14 days before (half refund)' => ['estricta', 14],
            'estricta at 13 days before (zero refund)' => ['estricta', 13],
            'estricta at 15 days before (still half refund)' => ['estricta', 15],
        ];
    }

    /**
     * @dataProvider tierBoundaryProvider
     */
    public function test_preview_and_actual_refund_are_byte_identical($tier, int $daysBeforeStart)
    {
        Carbon::setTestNow(Carbon::parse('2026-01-01 10:00:00'));

        $tenantUser = User::factory()->create();
        $tenant = Tenants::factory()->create(['user_id' => $tenantUser->id]);
        $room = StoreRooms::factory()->create(['cancellation_policy_tier' => $tier]);

        $reservation = Reservations::factory()->create([
            'store_room_id' => $room->id,
            'tenant_id' => $tenant->id,
            'status' => 'confirmed',
            'start_date' => Carbon::today()->addDays($daysBeforeStart)->toDateString(),
            'end_date' => Carbon::today()->addDays($daysBeforeStart + 30)->toDateString(),
            'total_mount' => 100,
            'rent_subtotal' => 80,
            'cancellation_policy_tier' => $tier,
        ]);

        $previewResponse = $this->actingAs($tenantUser, 'sanctum')
            ->getJson("/api/tenant/reservations/{$reservation->id}/cancellation-preview");

        $previewResponse->assertStatus(200);
        $previewAmount = $previewResponse->json('refund_amount');

        $cancelResponse = $this->actingAs($tenantUser, 'sanctum')
            ->patchJson("/api/tenant/reservations/{$reservation->id}/cancel", []);

        $cancelResponse->assertStatus(200);

        $this->assertDatabaseHas('reservations', [
            'id' => $reservation->id,
            'status' => 'canceled',
            'refund_amount' => $previewAmount,
        ]);
    }

    public function test_preview_returns_409_when_the_reservation_is_no_longer_cancellable()
    {
        $tenantUser = User::factory()->create();
        $tenant = Tenants::factory()->create(['user_id' => $tenantUser->id]);
        $room = StoreRooms::factory()->create(['cancellation_policy_tier' => 'flexible']);

        $reservation = Reservations::factory()->create([
            'store_room_id' => $room->id,
            'tenant_id' => $tenant->id,
            'status' => 'canceled',
            'start_date' => today()->addDays(5)->toDateString(),
            'end_date' => today()->addDays(30)->toDateString(),
        ]);

        $response = $this->actingAs($tenantUser, 'sanctum')
            ->getJson("/api/tenant/reservations/{$reservation->id}/cancellation-preview");

        $response->assertStatus(409);
    }

    public function test_preview_is_forbidden_for_a_non_owning_tenant()
    {
        $owner = Tenants::factory()->create();
        $room = StoreRooms::factory()->create();
        $reservation = Reservations::factory()->create([
            'store_room_id' => $room->id,
            'tenant_id' => $owner->id,
            'status' => 'confirmed',
            'start_date' => today()->addDays(5)->toDateString(),
            'end_date' => today()->addDays(30)->toDateString(),
        ]);

        $intruderUser = User::factory()->create();
        Tenants::factory()->create(['user_id' => $intruderUser->id]);

        $response = $this->actingAs($intruderUser, 'sanctum')
            ->getJson("/api/tenant/reservations/{$reservation->id}/cancellation-preview");

        $response->assertStatus(403);
    }

    public function test_preview_returns_404_for_a_missing_reservation()
    {
        $tenantUser = User::factory()->create();
        Tenants::factory()->create(['user_id' => $tenantUser->id]);

        $response = $this->actingAs($tenantUser, 'sanctum')
            ->getJson('/api/tenant/reservations/999999/cancellation-preview');

        $response->assertStatus(404);
    }
}
