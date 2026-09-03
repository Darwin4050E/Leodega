<?php

namespace Tests\Unit;

use App\Exceptions\ReservationPricingException;
use App\Models\StorePrices;
use App\Models\StoreRooms;
use App\Services\ReservationPricingService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ReservationPricingServiceTest extends TestCase
{
    use RefreshDatabase;

    public function test_quote_computes_exact_months()
    {
        $room = StoreRooms::factory()->create();
        StorePrices::factory()->create([
            'store_room_id' => $room->id,
            'mode' => 'month',
            'price' => 1000,
            'disponibility' => true,
        ]);

        $quote = (new ReservationPricingService)->quote($room, '2026-01-01', '2026-04-01');

        $this->assertSame('3000.00', $quote['rent_subtotal']);
        $this->assertSame('180.00', $quote['service_fee']);
        $this->assertSame('1000.00', $quote['deposit']);
        $this->assertSame('4180.00', $quote['total_mount']);
    }

    public function test_quote_rounds_up_a_partial_month()
    {
        $room = StoreRooms::factory()->create();
        StorePrices::factory()->create([
            'store_room_id' => $room->id,
            'mode' => 'month',
            'price' => 1000,
            'disponibility' => true,
        ]);

        // 2 full months + 10 extra days: the started remainder rounds up to 3 months.
        $quote = (new ReservationPricingService)->quote($room, '2026-01-01', '2026-03-11');

        $this->assertSame('3000.00', $quote['rent_subtotal']);
        $this->assertSame('4180.00', $quote['total_mount']);
    }

    public function test_quote_rounds_service_fee_to_nearest_cent()
    {
        $room = StoreRooms::factory()->create();
        StorePrices::factory()->create([
            'store_room_id' => $room->id,
            'mode' => 'month',
            'price' => 350,
            'disponibility' => true,
        ]);

        // 3 months x 350 = 1050 subtotal; 1050 * 0.06 = 63.00 exactly.
        $quote = (new ReservationPricingService)->quote($room, '2026-01-01', '2026-04-01');

        $this->assertSame('1050.00', $quote['rent_subtotal']);
        $this->assertSame('63.00', $quote['service_fee']);
    }

    public function test_quote_throws_when_no_month_price_row_exists()
    {
        $room = StoreRooms::factory()->create();
        StorePrices::factory()->create([
            'store_room_id' => $room->id,
            'mode' => 'day',
            'price' => 50,
            'disponibility' => true,
        ]);

        $this->expectException(ReservationPricingException::class);

        (new ReservationPricingService)->quote($room, '2026-01-01', '2026-04-01');
    }

    public function test_quote_throws_when_month_price_is_unavailable()
    {
        $room = StoreRooms::factory()->create();
        StorePrices::factory()->create([
            'store_room_id' => $room->id,
            'mode' => 'month',
            'price' => 1000,
            'disponibility' => false,
        ]);

        $this->expectException(ReservationPricingException::class);

        (new ReservationPricingService)->quote($room, '2026-01-01', '2026-04-01');
    }
}
