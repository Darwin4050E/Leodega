<?php

namespace Tests\Feature;

use App\Enums\OrganizationRole;
use App\Models\Organization;
use App\Models\OrganizationInvitation;
use App\Models\User;
use Illuminate\Database\Connection;
use Illuminate\Database\Events\QueryExecuting;
use Illuminate\Foundation\Testing\DatabaseTruncation;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Notification;
use Tests\TestCase;

/**
 * hue-01 INV-S120: a revoke racing an accept leaves one terminal state. The
 * row lock is the arbiter, which SQLite cannot show with two real connections.
 * PostgreSQL only; skipped on SQLite before the database is touched. Cannot
 * use RefreshDatabase: the competing connection must see committed data, so it
 * truncates and cleans up after itself (same idiom as
 * OrganizationInvitationConcurrencyTest).
 */
class OrganizationInvitationRevokeConcurrencyTest extends TestCase
{
    use DatabaseTruncation;

    private const COMPETITOR = 'invitation_revoke_competitor';

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

    public function test_a_revoke_that_loses_the_race_to_an_accept_is_409_and_the_accept_stands()
    {
        Notification::fake();
        Mail::fake();

        $admin = User::factory()->create(['role' => 'tenant', 'state' => 'active']);
        $invitee = User::factory()->create(['role' => 'tenant', 'state' => 'active']);
        $organization = Organization::factory()->withMember($admin, OrganizationRole::ADMIN)->create();
        $invitation = OrganizationInvitation::factory()->create([
            'organization_id' => $organization->id,
            'invited_user_id' => $invitee->id,
            'invited_by_user_id' => $admin->id,
            'email' => strtolower($invitee->email),
        ]);

        // The accept commits on its own connection after the request passed
        // its checks and just before the revoke takes the row lock.
        $raced = false;
        DB::listen(function ($query) {});
        DB::connection()->getEventDispatcher()->listen(QueryExecuting::class, function (QueryExecuting $event) use (&$raced, $invitation) {
            if ($raced || ! str_contains(strtolower($event->sql), 'for update')) {
                return;
            }

            $raced = true;
            $this->competitor()->table('organization_invitations')
                ->where('id', $invitation->id)
                ->update(['status' => 'accepted', 'responded_at' => now()]);
        });

        $this->actingAs($admin, 'sanctum')
            ->deleteJson("/api/organizations/{$organization->id}/invitations/{$invitation->id}")
            ->assertStatus(409)
            ->assertExactJson(['message' => 'Esta invitación ya no está disponible']);

        $this->assertTrue($raced, 'The revoke must reach a locking select.');
        $this->assertSame('accepted', $invitation->fresh()->status->value);
    }
}
