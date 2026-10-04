<?php

namespace Tests\Unit;

use App\Models\Reservations;
use App\Models\StoreRooms;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Covers StoreRooms::hasConfirmedReservationOverlapping() — the THIRD
 * reservation predicate on this model, answering "does this proposed date
 * range overlap ANY confirmed reservation, past, present, or future, on
 * this storeroom?". Distinct from activeReservations() (deletion guard,
 * Engram obs #217) and currentlyOccupiedReservations() (present-tense
 * occupancy check, Engram obs #225) — neither answers this question.
 */
class StoreRoomsOverlapTest extends TestCase
{
    use RefreshDatabase;

    public function test_no_confirmed_reservation_means_no_overlap()
    {
        $room = StoreRooms::factory()->create();

        $this->assertFalse($room->hasConfirmedReservationOverlapping('2026-10-01', '2026-10-10'));
    }

    public function test_range_fully_inside_a_confirmed_reservation_overlaps()
    {
        $room = StoreRooms::factory()->create();
        Reservations::factory()->create([
            'store_room_id' => $room->id,
            'status' => 'confirmed',
            'start_date' => '2026-10-01',
            'end_date' => '2026-10-10',
        ]);

        $this->assertTrue($room->hasConfirmedReservationOverlapping('2026-10-03', '2026-10-05'));
    }

    public function test_block_starting_exactly_on_reservation_end_date_overlaps()
    {
        $room = StoreRooms::factory()->create();
        Reservations::factory()->create([
            'store_room_id' => $room->id,
            'status' => 'confirmed',
            'start_date' => '2026-10-01',
            'end_date' => '2026-10-10',
        ]);

        $this->assertTrue($room->hasConfirmedReservationOverlapping('2026-10-10', '2026-10-15'));
    }

    public function test_block_ending_exactly_on_reservation_start_date_overlaps()
    {
        $room = StoreRooms::factory()->create();
        Reservations::factory()->create([
            'store_room_id' => $room->id,
            'status' => 'confirmed',
            'start_date' => '2026-10-10',
            'end_date' => '2026-10-20',
        ]);

        $this->assertTrue($room->hasConfirmedReservationOverlapping('2026-10-05', '2026-10-10'));
    }

    public function test_block_starting_the_day_after_reservation_end_date_is_allowed()
    {
        $room = StoreRooms::factory()->create();
        Reservations::factory()->create([
            'store_room_id' => $room->id,
            'status' => 'confirmed',
            'start_date' => '2026-10-01',
            'end_date' => '2026-10-10',
        ]);

        $this->assertFalse($room->hasConfirmedReservationOverlapping('2026-10-11', '2026-10-15'));
    }

    public function test_pending_reservation_never_counts_as_overlap()
    {
        $room = StoreRooms::factory()->create();
        Reservations::factory()->create([
            'store_room_id' => $room->id,
            'status' => 'pending',
            'start_date' => '2026-10-01',
            'end_date' => '2026-10-10',
        ]);

        $this->assertFalse($room->hasConfirmedReservationOverlapping('2026-10-03', '2026-10-05'));
    }
}
