<?php

namespace Tests\Unit;

use App\Services\OrganizationHistoryService;
use PHPUnit\Framework\TestCase;

/**
 * hue-03 PAN-9: rows of the history feed that share an instant are ordered by
 * this newest-first precedence, then by higher source id. The same table
 * feeds the SQL literals, so changing it here changes the feed order.
 */
class OrganizationHistoryRankTest extends TestCase
{
    // PAN-S63..S66
    public function test_the_rank_table_is_the_newest_first_precedence()
    {
        $this->assertSame(
            [
                'wallet_refund' => 5,
                'reservation_cancelled' => 4,
                'wallet_topup' => 3,
                'reservation_created' => 2,
                'member_joined' => 1,
            ],
            OrganizationHistoryService::RANK
        );
    }

    public function test_every_kind_has_its_own_rank()
    {
        $ranks = array_values(OrganizationHistoryService::RANK);

        $this->assertSame($ranks, array_unique($ranks));
    }
}
