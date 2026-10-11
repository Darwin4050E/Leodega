<?php

namespace Tests\Unit;

use App\Enums\OrganizationRole;
use App\Models\Organization;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class UserRoleInOrganizationTest extends TestCase
{
    use RefreshDatabase;

    public function test_returns_admin_member_or_null_by_live_pivot_role()
    {
        $admin = User::factory()->create();
        $member = User::factory()->create();
        $outsider = User::factory()->create();
        $organization = Organization::factory()
            ->withMember($admin, OrganizationRole::ADMIN)
            ->withMember($member, OrganizationRole::MEMBER)
            ->create();
        $other = Organization::factory()->create();

        $this->assertSame(OrganizationRole::ADMIN, $admin->roleInOrganization($organization->id));
        $this->assertSame(OrganizationRole::MEMBER, $member->roleInOrganization($organization->id));
        $this->assertNull($outsider->roleInOrganization($organization->id));
        $this->assertNull($admin->roleInOrganization($other->id));
    }

    public function test_reads_the_role_at_call_time_after_a_demotion()
    {
        $user = User::factory()->create();
        $organization = Organization::factory()->withMember($user, OrganizationRole::ADMIN)->create();
        $this->assertSame(OrganizationRole::ADMIN, $user->roleInOrganization($organization->id));

        $organization->users()->updateExistingPivot($user->id, ['role' => OrganizationRole::MEMBER->value]);

        $this->assertSame(OrganizationRole::MEMBER, $user->roleInOrganization($organization->id));
    }
}
