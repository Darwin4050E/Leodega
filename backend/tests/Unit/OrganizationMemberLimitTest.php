<?php

namespace Tests\Unit;

use App\Enums\OrganizationRole;
use App\Models\Organization;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * member-spending-limit ML-1, ML-17: the limit travels on the membership
 * pivot and the factory can set it.
 */
class OrganizationMemberLimitTest extends TestCase
{
    use RefreshDatabase;

    // ML-S64
    public function test_with_member_writes_the_pivot_limit_and_omitting_it_leaves_null()
    {
        $limited = User::factory()->create();
        $unlimited = User::factory()->create();

        $organization = Organization::factory()
            ->withMember($limited, OrganizationRole::MEMBER, '250.50')
            ->withMember($unlimited, OrganizationRole::ADMIN)
            ->create();

        $this->assertEquals(250.50, $organization->users()->whereKey($limited->id)->first()->pivot->monthly_limit);
        $this->assertNull($organization->users()->whereKey($unlimited->id)->first()->pivot->monthly_limit);
    }

    public function test_both_pivot_relations_expose_the_monthly_limit()
    {
        $user = User::factory()->create();
        $organization = Organization::factory()->withMember($user, 'member', '100.00')->create();

        $fromOrganization = $organization->users()->whereKey($user->id)->first()->pivot;
        $fromUser = $user->organizations()->whereKey($organization->id)->first()->pivot;

        $this->assertEquals(100, $fromOrganization->monthly_limit);
        $this->assertEquals(100, $fromUser->monthly_limit);
    }
}
