<?php

namespace Tests\Feature;

use App\Enums\OrganizationRole;
use App\Models\Organization;
use App\Models\OrganizationInvitation;
use App\Models\Reservations;
use App\Models\Tenants;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Testing\TestResponse;
use Tests\TestCase;

/**
 * hue-03 U1a: GET /organizations/{organization}/panel/summary (PAN-4, PAN-5,
 * PAN-14). The summary never writes: an expired hold is simply not counted.
 */
class OrganizationPanelSummaryTest extends TestCase
{
    use RefreshDatabase;

    private Organization $organization;

    private User $admin;

    private User $member;

    protected function setUp(): void
    {
        parent::setUp();

        Carbon::setTestNow('2026-10-10 12:00:00');

        $this->admin = $this->tenant();
        $this->member = $this->tenant();
        $this->organization = Organization::factory()
            ->withMember($this->admin, OrganizationRole::ADMIN)
            ->withMember($this->member, OrganizationRole::MEMBER)
            ->create();
    }

    protected function tearDown(): void
    {
        Carbon::setTestNow();

        parent::tearDown();
    }

    private function tenant(): User
    {
        $user = User::factory()->create(['role' => 'tenant', 'state' => 'active']);
        Tenants::factory()->create(['user_id' => $user->id]);

        return $user;
    }

    private function summary(User $caller, ?Organization $organization = null): TestResponse
    {
        $organization ??= $this->organization;

        return $this->actingAs($caller, 'sanctum')->getJson("/api/organizations/{$organization->id}/panel/summary");
    }

    private function reservation(array $attributes = [], ?Organization $organization = null, ?User $by = null): Reservations
    {
        if ($by !== null) {
            $attributes['tenant_id'] = $by->tenant->id;
        }

        return Reservations::factory()->forOrganization($organization ?? $this->organization)->create($attributes + [
            'start_date' => '2026-10-12',
            'end_date' => '2026-10-20',
            'status' => 'confirmed',
        ]);
    }

    private function invitation(string $state, ?Organization $organization = null): OrganizationInvitation
    {
        $factory = OrganizationInvitation::factory();

        return ($state === 'pending' ? $factory : $factory->{$state}())->create([
            'organization_id' => ($organization ?? $this->organization)->id,
            'invited_by_user_id' => $this->admin->id,
        ]);
    }

    // PAN-S16
    public function test_the_admin_summary_has_exactly_the_documented_keys()
    {
        $third = $this->tenant();
        $this->organization->users()->attach($third->id, ['role' => OrganizationRole::MEMBER->value]);
        $this->reservation();

        $response = $this->summary($this->admin)->assertOk();

        $this->assertSame(
            ['active_reservations_count', 'members_count', 'organization_id', 'pending_invitations_count', 'role'],
            collect($response->json())->keys()->sort()->values()->all()
        );
        $response->assertExactJson([
            'organization_id' => $this->organization->id,
            'role' => 'admin',
            'members_count' => 3,
            'active_reservations_count' => 1,
            'pending_invitations_count' => 0,
        ]);
    }

    // PAN-S17
    public function test_the_pending_count_is_the_effective_pending_invitations_only()
    {
        $this->invitation('pending');
        $this->invitation('pending');
        $this->invitation('accepted');
        $this->invitation('rejected');
        $this->invitation('cancelled');
        $this->invitation('lapsed');

        $this->summary($this->admin)->assertOk()->assertJsonPath('pending_invitations_count', 2);
    }

    // PAN-S18
    public function test_a_member_summary_has_no_pending_invitations_key_and_reports_the_member_role()
    {
        $this->invitation('pending');

        $response = $this->summary($this->member)->assertOk()->assertJsonPath('role', 'member');

        $this->assertArrayNotHasKey('pending_invitations_count', $response->json());
        $this->assertStringNotContainsString('pending_invitations', $response->getContent());
    }

    // PAN-S19
    public function test_a_brand_new_organization_reads_one_member_and_zeros()
    {
        $creator = $this->tenant();
        $solo = Organization::factory()->withMember($creator, OrganizationRole::ADMIN)->create();

        $this->summary($creator, $solo)->assertOk()->assertExactJson([
            'organization_id' => $solo->id,
            'role' => 'admin',
            'members_count' => 1,
            'active_reservations_count' => 0,
            'pending_invitations_count' => 0,
        ]);
    }

    // PAN-S20
    public function test_data_of_another_organization_is_not_counted()
    {
        $other = Organization::factory()->withMember($this->admin, OrganizationRole::ADMIN)->create();
        foreach (range(1, 4) as $unused) {
            $other->users()->attach($this->tenant()->id, ['role' => OrganizationRole::MEMBER->value]);
        }
        $this->reservation([], $other);
        $this->reservation([], $other);
        $this->invitation('pending', $other);
        $this->reservation();

        $this->summary($this->admin)->assertOk()->assertJson([
            'organization_id' => $this->organization->id,
            'members_count' => 2,
            'active_reservations_count' => 1,
            'pending_invitations_count' => 0,
        ]);
        $this->summary($this->admin, $other)->assertOk()->assertJson([
            'members_count' => 5,
            'active_reservations_count' => 2,
            'pending_invitations_count' => 1,
        ]);
    }

    // PAN-S21
    public function test_an_accepted_invitation_adds_a_member_and_removes_a_pending_one()
    {
        $invitee = $this->tenant();
        $invitation = OrganizationInvitation::factory()->create([
            'organization_id' => $this->organization->id,
            'invited_user_id' => $invitee->id,
            'invited_by_user_id' => $this->admin->id,
            'email' => strtolower($invitee->email),
        ]);

        $this->summary($this->admin)->assertJson(['members_count' => 2, 'pending_invitations_count' => 1]);

        $this->actingAs($invitee, 'sanctum')->postJson("/api/invitations/{$invitation->id}/accept")->assertOk();

        $this->summary($this->admin)->assertJson(['members_count' => 3, 'pending_invitations_count' => 0]);
    }

    // PAN-S22
    public function test_no_money_key_travels_in_the_summary()
    {
        $this->organization->update(['wallet_balance' => '80.50']);

        $content = $this->summary($this->admin)->assertOk()->getContent();

        foreach (['balance', 'spent', 'wallet'] as $needle) {
            $this->assertStringNotContainsString($needle, $content);
        }
    }

    // PAN-S23, PAN-S24
    public function test_an_organization_reservation_counts_until_its_end_date_has_passed()
    {
        $this->reservation(['start_date' => '2026-10-01', 'end_date' => '2026-10-10']);
        $this->reservation(['start_date' => '2026-10-01', 'end_date' => '2026-10-09']);

        $this->summary($this->admin)->assertJsonPath('active_reservations_count', 1);
    }

    // PAN-S25
    public function test_a_canceled_reservation_is_not_counted()
    {
        $this->reservation(['status' => 'canceled']);
        $this->reservation();

        $this->summary($this->admin)->assertJsonPath('active_reservations_count', 1);
    }

    // PAN-S26, PAN-S27
    public function test_an_unexpired_hold_counts_and_an_expired_hold_does_not_and_is_not_swept()
    {
        $this->reservation(['status' => 'pending', 'created_at' => now()->subMinutes(5)]);
        $expired = $this->reservation(['status' => 'pending', 'created_at' => now()->subMinutes(45)]);
        $before = DB::table('reservations')->orderBy('id')->get()->all();

        $this->summary($this->admin)->assertJsonPath('active_reservations_count', 1);

        $this->assertEquals($before, DB::table('reservations')->orderBy('id')->get()->all());
        $this->assertSame('pending', DB::table('reservations')->where('id', $expired->id)->value('status'));
    }

    // PAN-S28
    public function test_personal_and_other_organization_reservations_are_not_counted()
    {
        $personal = Reservations::factory()->create([
            'tenant_id' => $this->admin->tenant->id,
            'start_date' => '2026-10-12',
            'end_date' => '2026-10-20',
        ]);
        $this->reservation([], Organization::factory()->create());
        $this->reservation();

        $this->assertNull($personal->organization_id);
        $this->summary($this->admin)->assertJsonPath('active_reservations_count', 1);
    }

    // PAN-S42 (count half)
    public function test_a_member_counts_only_the_reservations_they_made()
    {
        $this->reservation([], null, $this->admin);
        $this->reservation([], null, $this->admin);
        $this->reservation([], null, $this->member);

        $this->summary($this->member)->assertJsonPath('active_reservations_count', 1);
        $this->summary($this->admin)->assertJsonPath('active_reservations_count', 3);
    }

    // PAN-S42 (count half), a member who made none
    public function test_a_member_without_reservations_counts_zero_while_others_exist()
    {
        $this->reservation([], null, $this->admin);

        $this->summary($this->member)->assertJsonPath('active_reservations_count', 0);
    }

    // PAN-S77
    public function test_an_organization_without_any_wallet_movement_still_answers_200()
    {
        $this->assertSame(0, DB::table('organization_wallet_movements')->count());

        $this->summary($this->admin)->assertOk()->assertJsonPath('members_count', 2);
    }

    // PAN-S82, PAN-S83
    public function test_the_member_body_has_no_admin_substrings_and_the_admin_body_has_them()
    {
        $this->invitation('pending');

        $memberBody = $this->summary($this->member)->assertOk()->getContent();
        $adminBody = $this->summary($this->admin)->assertOk()->getContent();

        $this->assertStringNotContainsString('email', $memberBody);
        $this->assertStringNotContainsString('pending_invitations', $memberBody);
        $this->assertStringContainsString('pending_invitations_count', $adminBody);
    }

    // PAN-S84, role per organization
    public function test_the_role_and_shape_are_per_organization()
    {
        $second = Organization::factory()->withMember($this->admin, OrganizationRole::MEMBER)->create();
        $this->organization->users()->updateExistingPivot($this->admin->id, ['role' => OrganizationRole::ADMIN->value]);

        $asAdmin = $this->summary($this->admin)->assertOk()->assertJsonPath('role', 'admin');
        $asMember = $this->summary($this->admin, $second)->assertOk()->assertJsonPath('role', 'member');

        $this->assertArrayHasKey('pending_invitations_count', $asAdmin->json());
        $this->assertArrayNotHasKey('pending_invitations_count', $asMember->json());
    }
}
