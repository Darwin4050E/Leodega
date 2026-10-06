<?php

namespace Tests\Feature;

use App\Models\Organization;
use App\Models\User;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

/**
 * HUE-04 U1: schema and model contract for organizations and their
 * membership pivot. Endpoint behavior lives in OrganizationTest.
 */
class OrganizationSchemaTest extends TestCase
{
    use RefreshDatabase;

    public function test_organizations_table_has_the_expected_columns()
    {
        $this->assertTrue(Schema::hasTable('organizations'));
        $this->assertTrue(Schema::hasColumns('organizations', [
            'id', 'name', 'ruc', 'email', 'logo_path', 'status', 'created_by', 'created_at', 'updated_at',
        ]));
    }

    public function test_logo_path_is_nullable_and_a_new_organization_has_no_logo()
    {
        $column = collect(Schema::getColumns('organizations'))->firstWhere('name', 'logo_path');

        $this->assertTrue($column['nullable']);
        $this->assertNull(Organization::factory()->create()->fresh()->logo_path);
    }

    public function test_status_defaults_to_active()
    {
        $organization = Organization::factory()->create();

        $this->assertSame('active', $organization->fresh()->status);
    }

    public function test_organization_user_table_has_the_expected_columns()
    {
        $this->assertTrue(Schema::hasTable('organization_user'));
        $this->assertTrue(Schema::hasColumns('organization_user', [
            'id', 'organization_id', 'user_id', 'role', 'joined_at',
        ]));
    }

    public function test_a_user_cannot_be_attached_twice_to_the_same_organization()
    {
        $user = User::factory()->create();
        $organization = Organization::factory()->create();

        $organization->users()->attach($user->id, ['role' => 'admin']);

        $this->expectException(UniqueConstraintViolationException::class);
        $organization->users()->attach($user->id, ['role' => 'member']);
    }

    public function test_the_same_user_can_belong_to_two_different_organizations()
    {
        $user = User::factory()->create();

        Organization::factory()->withMember($user)->create();
        Organization::factory()->withMember($user)->create();

        $this->assertSame(2, $user->organizations()->count());
    }

    public function test_deleting_the_creator_keeps_the_organization_and_nulls_created_by()
    {
        $creator = User::factory()->create();
        $organization = Organization::factory()->create(['created_by' => $creator->id]);

        $creator->delete();

        $this->assertNull($organization->fresh()->created_by);
    }

    public function test_deleting_a_member_removes_the_pivot_row_but_keeps_the_organization()
    {
        $member = User::factory()->create();
        $other = User::factory()->create();
        $organization = Organization::factory()->withMember($member)->withMember($other)->create();

        $member->delete();

        $this->assertDatabaseMissing('organization_user', ['user_id' => $member->id]);
        $this->assertDatabaseHas('organization_user', ['user_id' => $other->id]);
        $this->assertNotNull($organization->fresh());
    }

    public function test_with_member_defaults_to_the_admin_role_and_accepts_an_explicit_role()
    {
        $admin = User::factory()->create();
        $member = User::factory()->create();

        $organization = Organization::factory()
            ->withMember($admin)
            ->withMember($member, 'member')
            ->create();

        $this->assertSame('admin', $organization->users()->find($admin->id)->pivot->role);
        $this->assertSame('member', $organization->users()->find($member->id)->pivot->role);
    }

    public function test_user_organizations_relation_exposes_role_and_joined_at()
    {
        $user = User::factory()->create();
        Organization::factory()->withMember($user, 'member')->create();

        $organization = $user->organizations()->first();

        $this->assertSame('member', $organization->pivot->role);
        $this->assertNotNull($organization->pivot->joined_at);
    }
}
