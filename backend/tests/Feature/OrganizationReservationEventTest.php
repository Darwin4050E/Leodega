<?php

namespace Tests\Feature;

use App\Enums\ReservationEventKind;
use App\Models\Notifications;
use App\Models\OrganizationReservationEvent;
use App\Models\Reservations;
use App\Models\StoreRooms;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\Schema;
use RuntimeException;
use Tests\Concerns\BuildsOrganizationCancellationScenario;
use Tests\TestCase;

/**
 * HUE-06 U1b OR-21/OR-22: an admin cancel of an organization reservation
 * writes exactly one append-only `cancelled` event in the cancel transaction.
 */
class OrganizationReservationEventTest extends TestCase
{
    use BuildsOrganizationCancellationScenario;
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        Notification::fake();
        $this->buildScenario();
    }

    private function cancelledEvents(): \Illuminate\Database\Eloquent\Collection
    {
        return OrganizationReservationEvent::where('kind', ReservationEventKind::Cancelled->value)->get();
    }

    public function test_an_admin_cancel_writes_exactly_one_cancelled_event_with_actor_and_trimmed_reason()
    {
        $reservation = $this->paidReservation();

        $this->cancel($reservation, $this->admin, '  Cambio de planes internos  ')->assertOk();

        $event = $this->cancelledEvents()->sole();
        $this->assertSame($this->organization->id, $event->organization_id);
        $this->assertSame($reservation->id, $event->reservation_id);
        $this->assertSame($this->admin->id, $event->actor_user_id);
        $this->assertSame('Cambio de planes internos', $event->reason);
        $this->assertNull($event->attempted_action);
        $this->assertNotNull($event->created_at);
    }

    public function test_no_route_edits_or_deletes_an_event()
    {
        $routes = collect(Route::getRoutes()->getRoutes())->map->uri();

        $this->assertCount(0, $routes->filter(fn (string $uri) => str_contains($uri, 'event')));
    }

    public function test_an_event_stays_when_the_actor_loses_the_organization_membership()
    {
        $reservation = $this->paidReservation();
        $this->cancel($reservation, $this->admin)->assertOk();

        $this->organization->users()->detach($this->admin->id);

        $event = $this->cancelledEvents()->sole();
        $this->assertSame($this->admin->id, $event->actor_user_id);
    }

    public function test_rolling_the_migration_back_keeps_organizations_and_reservations()
    {
        $reservation = $this->paidReservation();
        $this->cancel($reservation, $this->admin)->assertOk();

        $migration = require database_path('migrations/2026_10_11_000001_create_organization_reservation_events_table.php');
        $migration->down();

        $this->assertFalse(Schema::hasTable('organization_reservation_events'));
        $this->assertDatabaseHas('organizations', ['id' => $this->organization->id]);
        $this->assertDatabaseHas('reservations', ['id' => $reservation->id]);
    }

    public function test_a_zero_refund_cancel_still_logs_the_event_without_a_wallet_movement()
    {
        $reservation = $this->paidReservation('100.00', 'estricta');

        $this->cancel($reservation, $this->admin)->assertOk();

        $this->assertCount(1, $this->cancelledEvents());
        $this->assertDatabaseMissing('organization_wallet_movements', ['type' => 'reembolso']);
    }

    public function test_a_denied_caller_writes_no_cancelled_event()
    {
        $reservation = $this->paidReservation();

        $this->cancel($reservation, $this->creator)->assertStatus(403);

        $this->assertCount(0, $this->cancelledEvents());
    }

    public function test_an_invalid_reason_writes_no_cancelled_event()
    {
        $reservation = $this->paidReservation();

        $this->cancel($reservation, $this->admin, 'corto')->assertStatus(422);

        $this->assertCount(0, $this->cancelledEvents());
    }

    public function test_an_ineligible_reservation_writes_no_cancelled_event()
    {
        $reservation = $this->paidReservation('100.00', 'moderada', ['start_date' => now()->toDateString()]);

        $this->cancel($reservation, $this->admin)->assertStatus(409);

        $this->assertCount(0, $this->cancelledEvents());
    }

    public function test_a_personal_cancel_writes_no_cancelled_event()
    {
        $reservation = Reservations::factory()->create([
            'store_room_id' => StoreRooms::factory()->approved()->create()->id,
            'tenant_id' => $this->creator->tenant->id,
            'status' => 'confirmed',
            'start_date' => now()->addDays(10)->toDateString(),
            'end_date' => now()->addDays(40)->toDateString(),
            'total_mount' => '100.00',
            'cancellation_policy_tier' => 'flexible',
        ]);

        $this->cancel($reservation, $this->creator, null)->assertOk();

        $this->assertCount(0, $this->cancelledEvents());
    }

    public function test_a_gestor_cancel_writes_no_cancelled_event()
    {
        $reservation = $this->paidReservation();

        $this->actingAs($this->gestor, 'sanctum')
            ->patchJson("/api/landlord/reservations/{$reservation->id}/cancel", ['reason' => 'El almacen sufrio un incendio'])
            ->assertOk();

        $this->assertCount(0, $this->cancelledEvents());
    }

    public function test_a_failure_after_the_event_rolls_the_whole_cancellation_back()
    {
        $reservation = $this->paidReservation();
        Notifications::creating(function () {
            throw new RuntimeException('notification insert failed');
        });

        $this->cancel($reservation, $this->admin)->assertStatus(500);

        $this->assertCount(0, $this->cancelledEvents());
        $this->assertSame('confirmed', $reservation->fresh()->status);
        $this->assertDatabaseMissing('organization_wallet_movements', ['type' => 'reembolso']);
    }
}
