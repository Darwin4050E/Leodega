<?php

namespace Tests\Feature;

use App\Enums\InvitationStatus;
use App\Enums\OrganizationRole;
use App\Models\Organization;
use App\Models\OrganizationInvitation;
use App\Models\User;
use Carbon\CarbonInterface;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Testing\TestResponse;
use Tests\TestCase;

/**
 * hue-01 U1a: GET /organizations/{organization}/invitations (INV-9, INV-5 list
 * half). The list never writes: a lapsed pending row is shown as expired
 * without being persisted.
 */
class OrganizationInvitationListTest extends TestCase
{
    use RefreshDatabase;

    private const KEYS = ['id', 'email', 'status', 'expires_at', 'created_at', 'responded_at', 'invited_by_name', 'can_be_revoked'];

    private Organization $organization;

    private User $admin;

    protected function setUp(): void
    {
        parent::setUp();

        $this->admin = User::factory()->create(['role' => 'tenant']);
        $this->organization = Organization::factory()->withMember($this->admin, OrganizationRole::ADMIN)->create();
    }

    private function list(?User $caller = null, ?Organization $organization = null, string $query = ''): TestResponse
    {
        $organization ??= $this->organization;

        return $this->actingAs($caller ?? $this->admin, 'sanctum')
            ->getJson("/api/organizations/{$organization->id}/invitations{$query}");
    }

    private function invitation(array $attributes = [], string $state = 'pending'): OrganizationInvitation
    {
        $factory = OrganizationInvitation::factory();

        if ($state !== 'pending') {
            $factory = $factory->{$state}();
        }

        return $factory->create($attributes + [
            'organization_id' => $this->organization->id,
            'invited_by_user_id' => $this->admin->id,
        ]);
    }

    private function createdAt(CarbonInterface $at): array
    {
        return ['created_at' => $at, 'updated_at' => $at];
    }

    // INV-S72
    public function test_the_response_is_the_flat_paginator_with_pending_count()
    {
        $this->invitation();

        $response = $this->list()->assertOk();

        foreach (['data', 'current_page', 'last_page', 'per_page', 'total', 'pending_count'] as $key) {
            $this->assertArrayHasKey($key, $response->json());
        }
    }

    // INV-S73, INV-S85, INV-S88
    public function test_items_have_exactly_the_invitation_keys_and_no_invitee_data()
    {
        $row = $this->invitation();

        $response = $this->list()->assertOk();

        $this->assertSame(self::KEYS, array_keys($response->json('data.0')));
        $invitee = $row->invitee;
        $this->assertStringNotContainsString($invitee->name, $response->getContent());
        $this->assertStringNotContainsString('user_id', $response->getContent());
    }

    // INV-S74
    public function test_all_five_statuses_are_listed()
    {
        foreach (['pending', 'accepted', 'rejected', 'cancelled', 'expired'] as $state) {
            $this->invitation([], $state);
        }

        $statuses = collect($this->list()->assertOk()->json('data'))->pluck('status')->sort()->values()->all();

        $this->assertSame(['accepted', 'cancelled', 'expired', 'pending', 'rejected'], $statuses);
    }

    // INV-S75
    public function test_rows_are_ordered_newest_first_then_by_higher_id()
    {
        $now = now()->startOfSecond();
        $oldest = $this->invitation($this->createdAt($now->copy()->subDays(2)));
        $tieA = $this->invitation($this->createdAt($now->copy()->subDay()));
        $tieB = $this->invitation($this->createdAt($now->copy()->subDay()));
        $newest = $this->invitation($this->createdAt($now));

        $ids = array_column($this->list()->assertOk()->json('data'), 'id');

        $this->assertSame([$newest->id, $tieB->id, $tieA->id, $oldest->id], $ids);
    }

    // INV-S76, INV-S77
    public function test_the_list_is_paginated_by_twenty_and_a_page_past_the_end_is_empty()
    {
        OrganizationInvitation::factory()->count(25)->create([
            'organization_id' => $this->organization->id,
            'invited_by_user_id' => $this->admin->id,
        ]);

        $first = $this->list()->assertOk();
        $this->assertCount(20, $first->json('data'));
        $this->assertSame(2, $first->json('last_page'));
        $this->assertSame(25, $first->json('total'));
        $this->assertSame(20, $first->json('per_page'));

        $this->assertCount(5, $this->list(null, null, '?page=2')->json('data'));

        $beyond = $this->list(null, null, '?page=9')->assertOk();
        $this->assertSame([], $beyond->json('data'));
        $this->assertSame(25, $beyond->json('total'));
    }

    // INV-S78
    public function test_an_invalid_page_behaves_as_the_first_page()
    {
        OrganizationInvitation::factory()->count(22)->create(['organization_id' => $this->organization->id]);
        $first = $this->list()->assertOk()->json('data');
        $this->assertCount(20, $first);

        foreach (['0', '-1', 'abc'] as $page) {
            $this->assertSame($first, $this->list(null, null, "?page={$page}")->assertOk()->json('data'));
        }
    }

    // INV-S79
    public function test_a_lapsed_pending_row_reads_expired_without_being_written()
    {
        $row = $this->invitation([], 'lapsed');

        $item = $this->list()->assertOk()->json('data.0');

        $this->assertSame('expired', $item['status']);
        $this->assertFalse($item['can_be_revoked']);
        $this->assertSame(InvitationStatus::Pending, $row->fresh()->status);
    }

    // INV-S80
    public function test_pending_count_counts_effective_pending_rows_across_all_pages()
    {
        OrganizationInvitation::factory()->count(20)->accepted()->create(['organization_id' => $this->organization->id]);
        OrganizationInvitation::factory()->count(2)->create(['organization_id' => $this->organization->id]);
        OrganizationInvitation::factory()->count(3)->lapsed()->create(['organization_id' => $this->organization->id]);

        $this->assertSame(2, $this->list()->json('pending_count'));
        $this->assertSame(2, $this->list(null, null, '?page=2')->json('pending_count'));
    }

    // INV-S81
    public function test_other_organizations_invitations_never_appear()
    {
        $mine = $this->invitation();
        OrganizationInvitation::factory()->create(['organization_id' => Organization::factory()]);

        $response = $this->list()->assertOk();

        $this->assertSame([$mine->id], array_column($response->json('data'), 'id'));
        $this->assertSame(1, $response->json('total'));
    }

    // INV-S14, INV-S82
    public function test_another_admin_sees_the_invitations_created_by_the_first()
    {
        $other = User::factory()->create(['role' => 'tenant']);
        $this->organization->users()->attach($other->id, ['role' => OrganizationRole::ADMIN->value]);
        $row = $this->invitation();

        $ids = array_column($this->list($other)->assertOk()->json('data'), 'id');

        $this->assertSame([$row->id], $ids);
    }

    // INV-S83
    public function test_a_deleted_inviter_reads_as_a_null_name()
    {
        $inviter = User::factory()->create(['role' => 'tenant']);
        $this->invitation(['invited_by_user_id' => $inviter->id]);
        $inviter->delete();

        $item = $this->list()->assertOk()->json('data.0');

        $this->assertArrayHasKey('invited_by_name', $item);
        $this->assertNull($item['invited_by_name']);
    }

    // INV-S84
    public function test_an_organization_without_invitations_lists_empty()
    {
        $response = $this->list()->assertOk();

        $this->assertSame([], $response->json('data'));
        $this->assertSame(0, $response->json('total'));
        $this->assertSame(0, $response->json('pending_count'));
        $this->assertSame(1, $response->json('last_page'));
    }

    // INV-S47 (list half)
    public function test_an_inactive_organization_still_lists()
    {
        $this->invitation();
        $this->organization->update(['status' => 'inactive']);

        $this->assertCount(1, $this->list()->assertOk()->json('data'));
    }
}
