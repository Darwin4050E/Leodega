<?php

namespace Tests\Feature;

use App\Models\Organization;
use App\Models\User;
use Illuminate\Database\QueryException;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

/**
 * hue-01 U1a: schema contract for `organization_invitations` (INV-1). The
 * status CHECK exists only on PostgreSQL, so its test skips on SQLite; the
 * partial unique index works on both drivers.
 */
class OrganizationInvitationSchemaTest extends TestCase
{
    use RefreshDatabase;

    private function tenant(): User
    {
        return User::factory()->create(['role' => 'tenant']);
    }

    private function insertInvitation(Organization $organization, User $invitee, string $status = 'pending', ?User $inviter = null): void
    {
        DB::table('organization_invitations')->insert([
            'organization_id' => $organization->id,
            'invited_user_id' => $invitee->id,
            'invited_by_user_id' => $inviter?->id,
            'email' => strtolower($invitee->email),
            'status' => $status,
            'expires_at' => now()->addDays(7),
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    // INV-S1
    public function test_the_table_has_the_expected_columns_and_no_token_column()
    {
        $this->assertTrue(Schema::hasTable('organization_invitations'));
        $this->assertTrue(Schema::hasColumns('organization_invitations', [
            'id', 'organization_id', 'invited_user_id', 'invited_by_user_id', 'email',
            'status', 'expires_at', 'responded_at', 'created_at', 'updated_at',
        ]));
        $this->assertFalse(Schema::hasColumn('organization_invitations', 'token'));
    }

    public function test_the_expected_indexes_exist()
    {
        $indexes = collect(Schema::getIndexes('organization_invitations'));

        $this->assertTrue($indexes->contains(fn (array $index) => $index['columns'] === ['invited_user_id', 'status']));
        $this->assertTrue($indexes->contains(fn (array $index) => $index['columns'] === ['organization_id', 'status']));
        $this->assertTrue($indexes->contains(
            fn (array $index) => $index['name'] === 'organization_invitations_pending_unique' && $index['unique']
        ));
    }

    public function test_status_defaults_to_pending_and_responded_at_is_nullable()
    {
        $organization = Organization::factory()->create();
        $invitee = $this->tenant();

        DB::table('organization_invitations')->insert([
            'organization_id' => $organization->id,
            'invited_user_id' => $invitee->id,
            'email' => 'a@example.com',
            'expires_at' => now()->addDays(7),
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $row = DB::table('organization_invitations')->first();
        $this->assertSame('pending', $row->status);
        $this->assertNull($row->responded_at);
        $this->assertNull($row->invited_by_user_id);
    }

    // INV-S3
    public function test_a_second_pending_row_for_the_same_pair_is_rejected()
    {
        $organization = Organization::factory()->create();
        $invitee = $this->tenant();
        $this->insertInvitation($organization, $invitee);

        $this->expectException(UniqueConstraintViolationException::class);
        $this->insertInvitation($organization, $invitee);
    }

    public function test_a_second_row_is_allowed_when_the_other_one_is_not_pending()
    {
        $organization = Organization::factory()->create();
        $invitee = $this->tenant();

        foreach (['accepted', 'rejected', 'cancelled', 'expired'] as $status) {
            $this->insertInvitation($organization, $invitee, $status);
        }
        $this->insertInvitation($organization, $invitee, 'pending');
        $this->insertInvitation($organization, $invitee, 'rejected');

        $this->assertDatabaseCount('organization_invitations', 6);
    }

    // INV-S4
    public function test_a_pending_row_is_allowed_for_another_organization_and_for_another_user()
    {
        $organization = Organization::factory()->create();
        $other = Organization::factory()->create();
        $invitee = $this->tenant();
        $another = $this->tenant();

        $this->insertInvitation($organization, $invitee);
        $this->insertInvitation($other, $invitee);
        $this->insertInvitation($organization, $another);

        $this->assertDatabaseCount('organization_invitations', 3);
    }

    // INV-S5
    public function test_deleting_the_organization_removes_its_invitations()
    {
        $organization = Organization::factory()->create();
        $survivor = Organization::factory()->create();
        $this->insertInvitation($organization, $this->tenant());
        $this->insertInvitation($survivor, $this->tenant());

        $organization->delete();

        $this->assertDatabaseCount('organization_invitations', 1);
        $this->assertDatabaseHas('organization_invitations', ['organization_id' => $survivor->id]);
    }

    public function test_deleting_the_invitee_removes_their_invitations()
    {
        $organization = Organization::factory()->create();
        $invitee = $this->tenant();
        $this->insertInvitation($organization, $invitee);

        $invitee->delete();

        $this->assertDatabaseCount('organization_invitations', 0);
    }

    public function test_deleting_the_inviter_keeps_the_row_with_a_null_inviter()
    {
        $organization = Organization::factory()->create();
        $inviter = $this->tenant();
        $invitee = $this->tenant();
        $this->insertInvitation($organization, $invitee, 'pending', $inviter);

        $inviter->delete();

        $row = DB::table('organization_invitations')->first();
        $this->assertNotNull($row);
        $this->assertNull($row->invited_by_user_id);
    }

    // INV-S6
    public function test_rolling_back_drops_the_table_and_keeps_organizations_and_users()
    {
        $organization = Organization::factory()->create();
        $user = $this->tenant();

        $this->assertTrue(Schema::hasTable('organization_invitations'));

        $this->artisan('migrate:rollback', ['--step' => 1])->assertExitCode(0);

        $this->assertFalse(Schema::hasTable('organization_invitations'));
        $this->assertDatabaseHas('organizations', ['id' => $organization->id]);
        $this->assertDatabaseHas('user', ['id' => $user->id]);
    }

    // INV-S2 (PostgreSQL only)
    public function test_pgsql_rejects_an_unknown_status()
    {
        if (DB::connection()->getDriverName() !== 'pgsql') {
            $this->markTestSkipped('Requires PostgreSQL: SQLite has no ADD CONSTRAINT.');
        }

        $organization = Organization::factory()->create();

        try {
            $this->insertInvitation($organization, $this->tenant(), 'foo');
            $this->fail('The status CHECK constraint did not reject an unknown status.');
        } catch (QueryException $e) {
            $this->assertSame('23514', $e->getCode());
        }
    }
}
