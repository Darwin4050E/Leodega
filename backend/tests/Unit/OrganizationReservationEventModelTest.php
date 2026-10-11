<?php

namespace Tests\Unit;

use App\Enums\ReservationEventKind;
use App\Models\OrganizationReservationEvent;
use Illuminate\Foundation\Testing\RefreshDatabase;
use LogicException;
use Tests\TestCase;

/**
 * HUE-06 OR-21: the organization reservation event log is append-only inside
 * the app, same convention as the wallet ledger.
 */
class OrganizationReservationEventModelTest extends TestCase
{
    use RefreshDatabase;

    public function test_updating_an_event_throws_and_leaves_the_row_unchanged()
    {
        $event = OrganizationReservationEvent::factory()->cancelled('Motivo original')->create();

        try {
            $event->update(['reason' => 'Motivo editado']);
            $this->fail('Updating an event must throw.');
        } catch (LogicException) {
            $this->assertSame('Motivo original', $event->fresh()->reason);
        }
    }

    public function test_deleting_an_event_throws_and_keeps_the_row()
    {
        $event = OrganizationReservationEvent::factory()->create();

        try {
            $event->delete();
            $this->fail('Deleting an event must throw.');
        } catch (LogicException) {
            $this->assertDatabaseHas('organization_reservation_events', ['id' => $event->id]);
        }
    }

    public function test_an_event_has_a_creation_time_but_no_update_time()
    {
        $event = OrganizationReservationEvent::factory()->create();

        $this->assertNull($event->getUpdatedAtColumn());
        $this->assertNotNull($event->fresh()->created_at);
    }

    public function test_the_cancelled_state_sets_the_kind_and_the_reason()
    {
        $event = OrganizationReservationEvent::factory()->cancelled('Cambio de planes')->create()->fresh();

        $this->assertSame(ReservationEventKind::Cancelled, $event->kind);
        $this->assertSame('Cambio de planes', $event->reason);
        $this->assertNull($event->attempted_action);
    }

    public function test_the_denied_attempt_state_sets_the_kind_and_the_attempted_action()
    {
        $event = OrganizationReservationEvent::factory()
            ->deniedAttempt(OrganizationReservationEvent::ACTION_PREVIEW)
            ->create()
            ->fresh();

        $this->assertSame(ReservationEventKind::DeniedAttempt, $event->kind);
        $this->assertSame('preview', $event->attempted_action);
        $this->assertNull($event->reason);
    }
}
