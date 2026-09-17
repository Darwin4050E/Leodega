<?php

namespace Tests\Unit;

use App\Support\ReservationCode;
use Tests\TestCase;

class ReservationCodeTest extends TestCase
{
    public function test_format_zero_pads_small_ids()
    {
        $this->assertSame('LEO-000042', ReservationCode::format(42));
    }

    public function test_format_does_not_truncate_large_ids()
    {
        $this->assertSame('LEO-204815', ReservationCode::format(204815));
    }
}
