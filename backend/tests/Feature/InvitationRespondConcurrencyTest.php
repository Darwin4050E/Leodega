<?php

namespace Tests\Feature;

use App\Enums\OrganizationRole;
use App\Models\Notifications;
use App\Models\Organization;
use App\Models\OrganizationInvitation;
use App\Models\User;
use Illuminate\Database\Connection;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Testing\DatabaseTruncation;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Notification;
use Illuminate\Testing\TestResponse;
use Tests\TestCase;

/**
 * huc-14 INV-S183 and INV-S216..S218: accepting an invitation races a revoke,
 * another accept and a reject, and the invitation row lock is the arbiter.
 * SQLite cannot show that with two real connections, so this runs on
 * PostgreSQL only and is skipped on SQLite before the database is touched.
 * It cannot use RefreshDatabase: the competing connection must see committed
 * data, so it truncates and cleans up after itself (same idiom as
 * OrganizationInvitationRevokeConcurrencyTest). USER-RUN on PostgreSQL 16.
 *
 * The competitor commits its write on its own connection right before the
 * request takes its invitation lock, which is the interleaving a real race
 * can produce; the loser must see the winner's committed state.
 */
class InvitationRespondConcurrencyTest extends TestCase
{
    use DatabaseTruncation;

    private const COMPETITOR = 'invitation_respond_competitor';

    private const IC12_UNAVAILABLE = 'Esta invitación ya no está disponible';

    private const IC80_ALREADY_RESPONDED = 'Ya respondiste esta invitación';

    private const LOCK_NOT_AVAILABLE = '55P03';

    private bool $competitorOpened = false;

    private Organization $organization;

    private User $admin;

    private User $invitee;

    private OrganizationInvitation $invitation;

    protected function beforeTruncatingDatabase(): void
    {
        if (DB::connection()->getDriverName() !== 'pgsql') {
            $this->markTestSkipped('Requires PostgreSQL: SQLite cannot run two concurrent connections.');
        }
    }

    protected function setUp(): void
    {
        parent::setUp();

        Notification::fake();
        Mail::fake();

        $this->admin = User::factory()->create(['role' => 'tenant', 'state' => 'active']);
        $this->invitee = User::factory()->create(['role' => 'tenant', 'state' => 'active']);
        $this->organization = Organization::factory()->withMember($this->admin, OrganizationRole::ADMIN)->create();
        $this->invitation = OrganizationInvitation::factory()->create([
            'organization_id' => $this->organization->id,
            'invited_user_id' => $this->invitee->id,
            'invited_by_user_id' => $this->admin->id,
            'email' => strtolower($this->invitee->email),
        ]);
    }

    protected function tearDown(): void
    {
        if ($this->app && DB::connection()->getDriverName() === 'pgsql') {
            while (DB::transactionLevel() > 0) {
                DB::rollBack();
            }

            if ($this->competitorOpened) {
                DB::purge(self::COMPETITOR);
            }

            $this->truncateTablesForAllConnections();
        }

        parent::tearDown();
    }

    private function competitor(): Connection
    {
        config(['database.connections.'.self::COMPETITOR => config('database.connections.'.config('database.default'))]);
        $this->competitorOpened = true;

        return DB::connection(self::COMPETITOR);
    }

    /**
     * Runs $competition once, on the competitor connection, right before the
     * request executes its first locking select.
     */
    private function raceBeforeTheFirstLock(callable $competition): void
    {
        $raced = false;
        DB::connection()->beforeExecuting(function (string $sql) use (&$raced, $competition) {
            if ($raced || ! str_contains(strtolower($sql), 'for update')) {
                return;
            }

            $raced = true;
            $competition($this->competitor());
        });
    }

    private function accept(): TestResponse
    {
        return $this->actingAs($this->invitee, 'sanctum')->postJson("/api/invitations/{$this->invitation->id}/accept");
    }

    private function membershipCount(): int
    {
        return DB::table('organization_user')->where('user_id', $this->invitee->id)->count();
    }

    // INV-S216: the revoke committed first, so the accept loses
    public function test_an_accept_that_loses_the_race_to_a_revoke_is_409_and_creates_no_membership()
    {
        $this->raceBeforeTheFirstLock(fn (Connection $competitor) => $competitor->table('organization_invitations')
            ->where('id', $this->invitation->id)
            ->update(['status' => 'cancelled']));

        $this->accept()->assertStatus(409)->assertExactJson(['message' => self::IC12_UNAVAILABLE]);

        $this->assertSame('cancelled', $this->invitation->fresh()->status->value);
        $this->assertSame(0, $this->membershipCount());
        $this->assertSame(0, Notifications::query()->count());
    }

    // INV-S217: the other accept committed first, so this one is a repeat
    public function test_an_accept_that_loses_the_race_to_another_accept_is_409_and_there_is_one_membership()
    {
        $this->raceBeforeTheFirstLock(function (Connection $competitor) {
            $competitor->table('organization_user')->insert([
                'organization_id' => $this->organization->id,
                'user_id' => $this->invitee->id,
                'role' => OrganizationRole::MEMBER->value,
                'joined_at' => now(),
            ]);
            $competitor->table('organization_invitations')
                ->where('id', $this->invitation->id)
                ->update(['status' => 'accepted', 'responded_at' => now()]);
        });

        $this->accept()->assertStatus(409)->assertExactJson(['message' => self::IC80_ALREADY_RESPONDED]);

        $this->assertSame('accepted', $this->invitation->fresh()->status->value);
        $this->assertSame(1, $this->membershipCount());
        $this->assertSame(0, Notifications::query()->count(), 'The loser must not create a second notification set.');
    }

    // INV-S218: the reject committed first, so the accept loses
    public function test_an_accept_that_loses_the_race_to_a_reject_is_409_and_creates_no_membership()
    {
        $this->raceBeforeTheFirstLock(fn (Connection $competitor) => $competitor->table('organization_invitations')
            ->where('id', $this->invitation->id)
            ->update(['status' => 'rejected', 'responded_at' => now()]));

        $this->accept()->assertStatus(409)->assertExactJson(['message' => self::IC80_ALREADY_RESPONDED]);

        $this->assertSame('rejected', $this->invitation->fresh()->status->value);
        $this->assertSame(0, $this->membershipCount());
    }

    // INV-S183: the invitation is selected FOR UPDATE and the organization after it
    public function test_the_accept_locks_the_invitation_row_before_the_organization_row()
    {
        DB::connection()->enableQueryLog();

        $this->accept()->assertOk();

        $locking = collect(DB::connection()->getQueryLog())
            ->pluck('query')
            ->map(fn (string $sql) => strtolower($sql))
            ->filter(fn (string $sql) => str_contains($sql, 'for update'))
            ->values();
        $invitationLock = $locking->search(fn (string $sql) => str_contains($sql, 'from "organization_invitations"'));
        $organizationLock = $locking->search(fn (string $sql) => str_contains($sql, 'from "organizations"'));

        $this->assertNotFalse($invitationLock, 'The invitation must be selected FOR UPDATE.');
        $this->assertNotFalse($organizationLock, 'The organization must be selected FOR UPDATE.');
        $this->assertLessThan($organizationLock, $invitationLock);
    }

    // INV-S183, INV-S221: both row locks are really held while the accept writes
    public function test_both_rows_stay_locked_to_another_connection_while_the_accept_is_writing()
    {
        $held = [];
        $probed = false;
        DB::connection()->beforeExecuting(function (string $sql) use (&$held, &$probed) {
            if ($probed || ! str_starts_with(strtolower($sql), 'insert into "organization_user"')) {
                return;
            }

            $probed = true;
            foreach (['organization_invitations' => $this->invitation->id, 'organizations' => $this->organization->id] as $table => $id) {
                try {
                    $this->competitor()->select("select id from {$table} where id = ? for update nowait", [$id]);
                    $held[$table] = false;
                } catch (QueryException $e) {
                    $held[$table] = str_contains($e->getMessage(), self::LOCK_NOT_AVAILABLE);
                }
            }
        });

        $this->accept()->assertOk();

        $this->assertTrue($probed, 'The accept must reach the membership insert.');
        $this->assertSame(['organization_invitations' => true, 'organizations' => true], $held);
    }
}
