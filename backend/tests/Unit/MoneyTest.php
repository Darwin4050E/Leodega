<?php

namespace Tests\Unit;

use App\Support\Money;
use InvalidArgumentException;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

/**
 * org-wallet OW-3: wallet amounts are exact to 2 decimals. Money converts
 * between decimal strings and integer cents; rounding is half away from zero
 * on the third decimal, done on the digits (never through float arithmetic).
 */
class MoneyTest extends TestCase
{
    // -- toCents / fromCents --------------------------------------------

    public function test_to_cents_converts_decimal_strings_exactly()
    {
        $this->assertSame(1000, Money::toCents('10.00'));
        $this->assertSame(50, Money::toCents('0.5'));
        $this->assertSame(10000, Money::toCents('100'));
        $this->assertSame(0, Money::toCents('0.00'));
    }

    public function test_to_cents_rounds_half_away_from_zero_on_the_third_decimal()
    {
        $this->assertSame(1001, Money::toCents('10.005'));
        $this->assertSame(3334, Money::toCents('33.335'));
        $this->assertSame(5001, Money::toCents('50.005'));
        $this->assertSame(1000, Money::toCents('10.004'));
        $this->assertSame(-1001, Money::toCents('-10.005'));
    }

    public function test_to_cents_formats_floats_with_six_decimals_before_rounding()
    {
        // 10.005 is stored as 10.00499999999999989... in binary64.
        $this->assertSame(1001, Money::toCents(10.005));
        $this->assertSame(3334, Money::toCents(33.335));
        $this->assertSame(500, Money::toCents(5));
    }

    public function test_to_cents_rejects_non_numeric_input()
    {
        $this->expectException(InvalidArgumentException::class);

        Money::toCents('abc');
    }

    public function test_from_cents_always_renders_two_decimals_as_a_string()
    {
        $this->assertSame('50.00', Money::fromCents(5000));
        $this->assertSame('0.05', Money::fromCents(5));
        $this->assertSame('0.00', Money::fromCents(0));
        $this->assertSame('80.50', Money::fromCents(8050));
    }

    public function test_from_cents_keeps_the_sign_of_negative_amounts()
    {
        $this->assertSame('-40.00', Money::fromCents(-4000));
        $this->assertSame('-0.05', Money::fromCents(-5));
    }

    // -- refund + penalty == original (OW-S8, OW-S9) ----------------------

    #[DataProvider('refundSplits')]
    public function test_refund_plus_penalty_equals_the_original_exactly(string $original, string $unroundedRefund, string $refund, string $penalty)
    {
        $originalCents = Money::toCents($original);
        $refundCents = Money::toCents($unroundedRefund);
        $penaltyCents = $originalCents - $refundCents;

        $this->assertSame($refund, Money::fromCents($refundCents));
        $this->assertSame($penalty, Money::fromCents($penaltyCents));
        $this->assertSame($original, Money::fromCents($refundCents + $penaltyCents));
    }

    public static function refundSplits(): array
    {
        return [
            'even total' => ['100.00', '33.335', '33.34', '66.66'],
            'odd-cent total' => ['100.01', '50.005', '50.01', '50.00'],
        ];
    }

    // -- strict parser for client-supplied amounts (OW-S7) -----------------

    public function test_parse_accepts_up_to_two_decimals()
    {
        $this->assertSame(5000, Money::parse('50'));
        $this->assertSame(10050, Money::parse('100.5'));
        $this->assertSame(10050, Money::parse('100.50'));
        $this->assertSame(5000000, Money::parse('50000.00'));
    }

    #[DataProvider('invalidClientAmounts')]
    public function test_parse_rejects_more_than_two_decimals_and_non_numeric_input(string $input)
    {
        $this->expectException(InvalidArgumentException::class);

        Money::parse($input);
    }

    public static function invalidClientAmounts(): array
    {
        return [
            'three decimals' => ['100.005'],
            'text' => ['abc'],
            'empty' => [''],
            'exponent' => ['1e3'],
            'negative' => ['-5'],
            'leading space' => [' 5'],
            'bare dot' => ['5.'],
            'no integer part' => ['.5'],
        ];
    }
}
