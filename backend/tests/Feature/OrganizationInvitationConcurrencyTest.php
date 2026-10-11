<?php

namespace Tests\Feature;

use App\Enums\OrganizationRole;
use App\Models\Organization;
use App\Models\OrganizationInvitation;
use App\Models\User;
use Illuminate\Database\Connection;
use Illuminate\Foundation\Testing\DatabaseTruncation;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Notification;
use Tests\TestCase;

/**
 * hue-01 INV-S7: two concurrent invites for the same (organization, invitee)
 * leave exactly one pending row and the loser gets the duplicate 422. The
 * partial unique index is the arbiter, which SQLite cannot show with two real
 * connections. PostgreSQL only; skipped on SQLite before the database is
 * touched. Cannot use RefreshDatabase: the competing connection must see
 * committed data, so it truncates and cleans up after itself (same idiom as
 * OrganizationWalletLockingTest).
 */
class OrganizationInvitationConcurrencyTest extends TestCase
{
    use DatabaseTruncation;

    private const COMPETITOR = 'invitation_competitor';

    private bool $competitorOpened = false;

    protected function beforeTruncatingDatabase(): void
    {
        if (DB::connection()->getDriverName() !== 'pgsql') {
            $this->markTestSkipped('Requires PostgreSQL: SQLite cannot run two concurrent connections.');
        }
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

    public function test_two_connections_racing_for_the_same_invitee_yield_one_pending_row_and_one_422()
    {
        Notification::fake();
        Mail::fake();

        $admin = User::factory()->create(['role' => 'tenant', 'state' => 'active']);
        $invitee = User::factory()->create(['role' => 'tenant', 'state' => 'active']);
        $organization = Organization::factory()->withMember($admin, OrganizationRole::ADMIN)->create();

        // The competitor commits on its own connection after the request has
        // passed its checks and just before it inserts.
        Event::listen('eloquent.creating: '.OrganizationInvitation::class, function () use ($organization, $invitee, $admin) {
            $this->competitor()->table('organization_invitations')->insert([
                'organization_id' => $organization->id,
                'invited_user_id' => $invitee->id,
                'invited_by_user_id' => $admin->id,
                'email' => strtolower($invitee->email),
                'status' => 'pending',
                'expires_at' => now()->addDays(7),
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        });

        $this->actingAs($admin, 'sanctum')
            ->postJson("/api/organizations/{$organization->id}/invitations", ['email' => $invitee->email])
            ->assertUnprocessable()
            ->assertJsonPath('errors.email.0', 'Ya hay una invitación pendiente para este usuario en tu organización.');

        $this->assertSame(1, OrganizationInvitation::query()
            ->where('organization_id', $organization->id)
            ->where('invited_user_id', $invitee->id)
            ->where('status', 'pending')
            ->count());
    }
}
