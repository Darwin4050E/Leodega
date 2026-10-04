<?php

namespace Tests\Unit;

use App\Support\CancellationRefundCalculator;
use Tests\TestCase;

class CancellationRefundCalculatorTest extends TestCase
{
    private function daysFromToday(int $days): string
    {
        return now()->addDays($days)->toDateString();
    }

    // -- flexible: 100% while daysBeforeStart >= 1, else 0% --------------

    public function test_flexible_at_exactly_one_day_before_start_is_full_refund()
    {
        $refund = CancellationRefundCalculator::compute('flexible', $this->daysFromToday(1), '100.00');

        $this->assertSame('100.00', $refund);
    }

    public function test_flexible_at_two_days_before_start_is_still_full_refund()
    {
        $refund = CancellationRefundCalculator::compute('flexible', $this->daysFromToday(2), '100.00');

        $this->assertSame('100.00', $refund);
    }

    public function test_flexible_at_zero_days_before_start_is_zero_refund()
    {
        $refund = CancellationRefundCalculator::compute('flexible', $this->daysFromToday(0), '100.00');

        $this->assertSame('0.00', $refund);
    }

    // -- moderada: 100% >= 7 days, 50% for 1-6 days, 0% at 0 or fewer ----

    public function test_moderada_at_exactly_seven_days_before_start_is_full_refund()
    {
        $refund = CancellationRefundCalculator::compute('moderada', $this->daysFromToday(7), '100.00');

        $this->assertSame('100.00', $refund);
    }

    public function test_moderada_at_six_days_before_start_is_half_refund()
    {
        $refund = CancellationRefundCalculator::compute('moderada', $this->daysFromToday(6), '100.00');

        $this->assertSame('50.00', $refund);
    }

    public function test_moderada_at_eight_days_before_start_is_still_full_refund()
    {
        $refund = CancellationRefundCalculator::compute('moderada', $this->daysFromToday(8), '100.00');

        $this->assertSame('100.00', $refund);
    }

    public function test_moderada_at_exactly_one_day_before_start_is_half_refund()
    {
        $refund = CancellationRefundCalculator::compute('moderada', $this->daysFromToday(1), '100.00');

        $this->assertSame('50.00', $refund);
    }

    public function test_moderada_at_zero_days_before_start_is_zero_refund()
    {
        $refund = CancellationRefundCalculator::compute('moderada', $this->daysFromToday(0), '100.00');

        $this->assertSame('0.00', $refund);
    }

    // -- estricta: 50% >= 14 days, 0% below -------------------------------

    public function test_estricta_at_exactly_fourteen_days_before_start_is_half_refund()
    {
        $refund = CancellationRefundCalculator::compute('estricta', $this->daysFromToday(14), '100.00');

        $this->assertSame('50.00', $refund);
    }

    public function test_estricta_at_thirteen_days_before_start_is_zero_refund()
    {
        $refund = CancellationRefundCalculator::compute('estricta', $this->daysFromToday(13), '100.00');

        $this->assertSame('0.00', $refund);
    }

    public function test_estricta_at_fifteen_days_before_start_is_still_half_refund()
    {
        $refund = CancellationRefundCalculator::compute('estricta', $this->daysFromToday(15), '100.00');

        $this->assertSame('50.00', $refund);
    }

    // -- unknown tier: conservative zero refund --------------------------

    public function test_unknown_tier_yields_zero_refund()
    {
        $refund = CancellationRefundCalculator::compute('unknown-tier', $this->daysFromToday(30), '100.00');

        $this->assertSame('0.00', $refund);
    }

    // -- rounding: half-up to the cent ------------------------------------

    /**
     * Spec's worked example: $10.01 total at a 50% bucket ->
     * 1001 cents * 0.5 = 500.5 cents -> half-up -> 501 cents -> $5.01.
     */
    public function test_odd_cent_fifty_percent_split_rounds_half_up()
    {
        $refund = CancellationRefundCalculator::compute('moderada', $this->daysFromToday(5), '10.01');

        $this->assertSame('5.01', $refund);
    }
}
