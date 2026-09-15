<?php

namespace Tests\Unit;

use App\Exceptions\ReservationPricingException;
use App\Models\StorePrices;
use App\Models\StoreRooms;
use App\Services\ReservationPricingService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * The customer pays RENT ONLY. The deposit is zero — it is still returned by
 * quote() so the response shape stays stable, but it is never charged while
 * no hold/release flow exists that could return it.
 *
 * The service fee is a COMMISSION deducted from the rent, never a surcharge
 * added on top: the landlord receives the rent minus the fee. These
 * assertions are the safety net for what customers are actually charged, so
 * several of them assert the total = rent_subtotal + deposit RELATIONSHIP
 * rather than only literals, and so a future edit that re-adds a non-zero
 * deposit without a refund flow fails loudly here.
 */
class ReservationPricingServiceTest extends TestCase
{
    use RefreshDatabase;

    private function roomPricedAt(float $monthlyPrice, bool $disponibility = true, string $mode = 'month'): StoreRooms
    {
        $room = StoreRooms::factory()->create();
        StorePrices::factory()->create([
            'store_room_id' => $room->id,
            'mode' => $mode,
            'price' => $monthlyPrice,
            'disponibility' => $disponibility,
        ]);

        return $room;
    }

    public function test_quote_charges_rent_only_for_a_single_month()
    {
        $room = $this->roomPricedAt(780);

        $quote = (new ReservationPricingService)->quote($room, '2026-01-01', '2026-02-01');

        $this->assertSame('780.00', $quote['rent_subtotal']);
        $this->assertSame('46.80', $quote['service_fee']);
        // No deposit is charged: no hold/release flow exists to return one.
        $this->assertSame('0.00', $quote['deposit']);
        // 780 rent, nothing else. The 46.80 commission comes OUT of the rent,
        // leaving the landlord 733.20 net; it is never added to the total.
        $this->assertSame('780.00', $quote['total_mount']);
    }

    public function test_quote_computes_exact_months_without_adding_the_service_fee_or_a_deposit()
    {
        $room = $this->roomPricedAt(1000);

        $quote = (new ReservationPricingService)->quote($room, '2026-01-01', '2026-04-01');

        $this->assertSame('3000.00', $quote['rent_subtotal']);
        $this->assertSame('180.00', $quote['service_fee']);
        $this->assertSame('0.00', $quote['deposit']);
        $this->assertSame('3000.00', $quote['total_mount']);
    }

    public function test_quote_rounds_up_a_partial_month()
    {
        $room = $this->roomPricedAt(1000);

        // 2 full months + 10 extra days: the started remainder rounds up to 3 months.
        $quote = (new ReservationPricingService)->quote($room, '2026-01-01', '2026-03-11');

        $this->assertSame('3000.00', $quote['rent_subtotal']);
        $this->assertSame('3000.00', $quote['total_mount']);
    }

    public function test_quote_rounds_the_commission_to_the_nearest_cent_without_charging_it()
    {
        $room = $this->roomPricedAt(100.09);

        // 3 months x 100.09 = 300.27 subtotal; 300.27 * 0.06 = 18.0162 -> 18.02.
        $quote = (new ReservationPricingService)->quote($room, '2026-01-01', '2026-04-01');

        $this->assertSame('300.27', $quote['rent_subtotal']);
        $this->assertSame('18.02', $quote['service_fee']);
        $this->assertSame('0.00', $quote['deposit']);
        // The rounded commission is absent from the total, and so is any deposit.
        $this->assertSame('300.27', $quote['total_mount']);
    }

    public function test_quote_total_always_equals_rent_subtotal_plus_a_zero_deposit()
    {
        $cases = [
            [780, '2026-01-01', '2026-02-01'],
            [1000, '2026-01-01', '2026-04-01'],
            [100.09, '2026-01-01', '2026-04-01'],
            [333.33, '2026-01-01', '2026-03-11'],
            [75.5, '2026-01-01', '2026-07-01'],
        ];

        foreach ($cases as [$price, $start, $end]) {
            $room = $this->roomPricedAt($price);

            $quote = (new ReservationPricingService)->quote($room, $start, $end);

            // The deposit is part of the shape but must contribute nothing:
            // assert it is zero AND that the total is the rent alone, so
            // re-adding a deposit breaks this test rather than sliding through.
            $this->assertSame(
                0,
                $this->toCents($quote['deposit']),
                "deposit must stay at zero for price {$price} ({$start} -> {$end})"
            );

            $expectedTotalCents = $this->toCents($quote['rent_subtotal']) + $this->toCents($quote['deposit']);

            $this->assertSame(
                $expectedTotalCents,
                $this->toCents($quote['total_mount']),
                "total_mount must equal rent_subtotal + deposit for price {$price} ({$start} -> {$end})"
            );

            $this->assertSame(
                $this->toCents($quote['rent_subtotal']),
                $this->toCents($quote['total_mount']),
                "total_mount must equal rent_subtotal exactly for price {$price} ({$start} -> {$end})"
            );
        }
    }

    public function test_quote_still_reports_the_service_fee_as_six_percent_of_the_rent()
    {
        $cases = [
            [780, '2026-01-01', '2026-02-01'],
            [1000, '2026-01-01', '2026-04-01'],
            [100.09, '2026-01-01', '2026-04-01'],
            [333.33, '2026-01-01', '2026-03-11'],
        ];

        foreach ($cases as [$price, $start, $end]) {
            $room = $this->roomPricedAt($price);

            $quote = (new ReservationPricingService)->quote($room, $start, $end);

            $this->assertArrayHasKey('service_fee', $quote);

            $expectedFeeCents = (int) round($this->toCents($quote['rent_subtotal']) * 0.06);

            $this->assertSame(
                $expectedFeeCents,
                $this->toCents($quote['service_fee']),
                "service_fee must stay at 6% of rent_subtotal for price {$price}"
            );
        }
    }

    public function test_quote_throws_when_no_month_price_row_exists()
    {
        $room = $this->roomPricedAt(50, true, 'day');

        $this->expectException(ReservationPricingException::class);

        (new ReservationPricingService)->quote($room, '2026-01-01', '2026-04-01');
    }

    public function test_quote_throws_when_month_price_is_unavailable()
    {
        $room = $this->roomPricedAt(1000, false);

        $this->expectException(ReservationPricingException::class);

        (new ReservationPricingService)->quote($room, '2026-01-01', '2026-04-01');
    }

    private function toCents(string $decimal): int
    {
        return (int) round(((float) $decimal) * 100);
    }
}
