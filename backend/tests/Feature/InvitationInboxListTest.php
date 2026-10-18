<?php

namespace Tests\Feature;

use App\Enums\InvitationStatus;
use App\Enums\OrganizationRole;
use App\Models\Notifications;
use App\Models\Organization;
use App\Models\OrganizationInvitation;
use App\Models\User;
use Carbon\Carbon;
use Carbon\CarbonInterface;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Testing\TestResponse;
use Tests\TestCase;

/**
 * huc-14 U1a INV-16: GET /api/invitations, the invitee inbox. Only effective
 * pending and effective expired rows of the caller are listed; the endpoint
 * never writes.
 */
class InvitationInboxListTest extends TestCase
{
    use RefreshDatabase;

    private const ITEM_KEYS = [
        'id', 'organization_id', 'organization_name', 'invited_by_name', 'role', 'status',
        'expires_at', 'created_at', 'responded_at', 'can_respond',
    ];

    private User $invitee;

    private User $inviter;

    protected function setUp(): void
    {
        parent::setUp();

        $this->invitee = User::factory()->create(['role' => 'tenant', 'state' => 'active']);
        $this->inviter = User::factory()->create(['role' => 'tenant', 'state' => 'active']);
    }

    private function list(?User $caller = null): TestResponse
    {
        return $this->actingAs($caller ?? $this->invitee, 'sanctum')->getJson('/api/invitations');
    }

    /**
     * One invitation for the invitee in a fresh organization (the partial
     * unique allows a single pending row per organization and invitee).
     *
     * @param  array<string, mixed>  $attributes
     */
    private function invitation(string $state = 'pending', array $attributes = [], ?Organization $organization = null, ?User $invitee = null): OrganizationInvitation
    {
        $organization ??= Organization::factory()->withMember($this->inviter, OrganizationRole::ADMIN)->create();
        $invitee ??= $this->invitee;
        $factory = OrganizationInvitation::factory();

        return ($state === 'pending' ? $factory : $factory->{$state}())->create($attributes + [
            'organization_id' => $organization->id,
            'invited_user_id' => $invitee->id,
            'invited_by_user_id' => $this->inviter->id,
            'email' => strtolower($invitee->email),
        ]);
    }

    private function createdAt(CarbonInterface $at): array
    {
        return ['created_at' => $at, 'updated_at' => $at];
    }

    private function ids(TestResponse $response): array
    {
        return array_column($response->json('data'), 'id');
    }

    // INV-S142
    public function test_the_envelope_has_exactly_data_and_pending_count()
    {
        $this->invitation();

        $response = $this->list()->assertOk();

        $this->assertSame(['data', 'pending_count'], array_keys($response->json()));
    }

    // INV-S143
    public function test_an_item_has_exactly_the_ten_keys()
    {
        $this->invitation();

        $item = $this->list()->assertOk()->json('data.0');

        $this->assertSame(self::ITEM_KEYS, array_keys($item));
    }

    // INV-S144
    public function test_a_pending_item_reads_pending_and_can_be_answered()
    {
        $organization = Organization::factory()->withMember($this->inviter, OrganizationRole::ADMIN)->create(['name' => 'Andina']);
        $invitation = $this->invitation('pending', [], $organization);

        $organization->update(['name' => 'Andina Renombrada']);

        $this->list()->assertOk()->assertJson(['data' => [[
            'id' => $invitation->id,
            'organization_id' => $organization->id,
            'organization_name' => 'Andina Renombrada',
            'invited_by_name' => $this->inviter->name,
            'role' => 'member',
            'status' => 'pending',
            'responded_at' => null,
            'can_respond' => true,
        ]]]);
    }

    // INV-S145
    public function test_a_lapsed_pending_row_is_listed_expired_and_stays_pending_in_the_database()
    {
        $lapsed = $this->invitation('lapsed');

        $this->list()->assertOk()->assertJson(['data' => [[
            'id' => $lapsed->id,
            'status' => 'expired',
            'can_respond' => false,
        ]]]);
        $this->assertDatabaseHas('organization_invitations', ['id' => $lapsed->id, 'status' => 'pending']);
    }

    // INV-S146
    public function test_a_stored_expired_row_is_listed_expired()
    {
        $expired = $this->invitation('expired');

        $this->list()->assertOk()->assertJson(['data' => [[
            'id' => $expired->id,
            'status' => 'expired',
            'can_respond' => false,
        ]]]);
    }

    // INV-S147
    public function test_accepted_rejected_and_cancelled_rows_are_not_listed()
    {
        $this->invitation('accepted');
        $this->invitation('rejected');
        $this->invitation('cancelled');
        $pending = $this->invitation();

        $this->assertSame([$pending->id], $this->ids($this->list()->assertOk()));
    }

    // INV-S148
    public function test_invitations_of_other_tenants_are_not_listed()
    {
        $other = User::factory()->create(['role' => 'tenant', 'state' => 'active']);
        $this->invitation('pending', [], null, $other);
        $mine = $this->invitation();

        $this->assertSame([$mine->id], $this->ids($this->list()->assertOk()));
        $this->assertCount(1, $this->list($other)->json('data'));
    }

    // INV-S149
    public function test_pending_come_first_newest_first_then_expired_by_expiry_desc()
    {
        $now = Carbon::parse('2026-10-17 12:00:00');
        Carbon::setTestNow($now);

        $olderPending = $this->invitation('pending', $this->createdAt($now->copy()->subDays(3)));
        $newerPending = $this->invitation('pending', $this->createdAt($now->copy()->subDay()));
        $tiePending = $this->invitation('pending', $this->createdAt($now->copy()->subDay()));
        $expiredEarlier = $this->invitation('expired', ['expires_at' => $now->copy()->subDays(5)]);
        $expiredLater = $this->invitation('lapsed', ['expires_at' => $now->copy()->subHours(2)]);

        $this->assertSame(
            [$tiePending->id, $newerPending->id, $olderPending->id, $expiredLater->id, $expiredEarlier->id],
            $this->ids($this->list()->assertOk())
        );
    }

    // INV-S150
    public function test_expired_rows_are_capped_to_the_twenty_most_recent()
    {
        $now = Carbon::parse('2026-10-17 12:00:00');
        Carbon::setTestNow($now);

        $rows = collect(range(1, 25))->map(
            fn (int $day) => $this->invitation('expired', ['expires_at' => $now->copy()->subDays($day)])
        );

        $listed = $this->ids($this->list()->assertOk());

        $this->assertCount(20, $listed);
        $this->assertSame($rows->take(20)->pluck('id')->all(), $listed);
    }

    // INV-S151
    public function test_every_pending_row_is_returned_without_pagination()
    {
        collect(range(1, 25))->each(fn () => $this->invitation());

        $response = $this->list()->assertOk();

        $this->assertCount(25, $response->json('data'));
        $this->assertSame(['data', 'pending_count'], array_keys($response->json()));
        $this->assertSame(25, $response->json('pending_count'));
    }

    // INV-S152
    public function test_pending_count_counts_only_effective_pending_rows()
    {
        collect(range(1, 3))->each(fn () => $this->invitation());
        $this->invitation('expired');
        $this->invitation('lapsed');

        $response = $this->list()->assertOk();

        $this->assertCount(5, $response->json('data'));
        $this->assertSame(3, $response->json('pending_count'));
    }

    // INV-S153
    public function test_an_empty_inbox_is_an_empty_list_and_zero()
    {
        $this->invitation('accepted');

        $this->list()->assertOk()->assertExactJson(['data' => [], 'pending_count' => 0]);
    }

    // INV-S154
    public function test_an_invitation_to_an_inactive_organization_is_still_listed_pending()
    {
        $organization = Organization::factory()->inactive()->create();
        $this->invitation('pending', [], $organization);

        $this->list()->assertOk()->assertJson(['data' => [['status' => 'pending', 'can_respond' => true]]]);
    }

    // INV-S155
    public function test_a_deleted_inviter_reads_as_a_null_name()
    {
        $this->invitation();
        $this->inviter->delete();

        $item = $this->list()->assertOk()->assertJsonCount(1, 'data')->json('data.0');

        $this->assertArrayHasKey('invited_by_name', $item);
        $this->assertNull($item['invited_by_name']);
    }

    // INV-S156
    public function test_an_item_leaks_no_admin_invitee_organization_or_inviter_data()
    {
        $admin = User::factory()->create(['role' => 'tenant', 'state' => 'active']);
        $organization = Organization::factory()
            ->withMember($this->inviter, OrganizationRole::ADMIN)
            ->withMember($admin, OrganizationRole::ADMIN)
            ->create(['name' => 'Andina']);
        $this->invitation('pending', [], $organization);

        $response = $this->list()->assertOk();
        $body = $response->getContent();

        $this->assertSame(self::ITEM_KEYS, array_keys($response->json('data.0')));
        foreach ([$admin->name, $admin->email, $this->invitee->email, $organization->ruc, $organization->email] as $secret) {
            $this->assertStringNotContainsString($secret, $body);
        }
        $this->assertStringNotContainsString('"invited_by_user_id"', $body);
        $this->assertStringNotContainsString('wallet', $body);
    }

    // INV-S157
    public function test_listing_writes_no_invitation_or_notification()
    {
        $lapsed = $this->invitation('lapsed');
        $pending = $this->invitation();
        $before = OrganizationInvitation::query()->orderBy('id')->get()->toArray();

        $this->list()->assertOk();

        $this->assertSame($before, OrganizationInvitation::query()->orderBy('id')->get()->toArray());
        $this->assertSame(InvitationStatus::Pending, $lapsed->fresh()->status);
        $this->assertSame(InvitationStatus::Pending, $pending->fresh()->status);
        $this->assertSame(0, Notifications::query()->count());
    }

    // INV-S158
    public function test_the_expiry_boundary_is_exclusive()
    {
        $now = Carbon::parse('2026-10-17 12:00:00');
        Carbon::setTestNow($now);

        $atNow = $this->invitation('pending', ['expires_at' => $now->copy()]);
        $oneSecondLeft = $this->invitation('pending', ['expires_at' => $now->copy()->addSecond()]);

        $items = collect($this->list()->assertOk()->json('data'))->keyBy('id');

        $this->assertSame('expired', $items[$atNow->id]['status']);
        $this->assertFalse($items[$atNow->id]['can_respond']);
        $this->assertSame('pending', $items[$oneSecondLeft->id]['status']);
        $this->assertTrue($items[$oneSecondLeft->id]['can_respond']);
    }

    // INV-S159
    public function test_an_old_accepted_row_does_not_hide_a_newer_pending_row_of_the_same_organization()
    {
        $organization = Organization::factory()->withMember($this->inviter, OrganizationRole::ADMIN)->create();
        $this->invitation('accepted', [], $organization);
        $pending = $this->invitation('pending', [], $organization);

        $this->assertSame([$pending->id], $this->ids($this->list()->assertOk()));
    }

    protected function tearDown(): void
    {
        Carbon::setTestNow();

        parent::tearDown();
    }
}
