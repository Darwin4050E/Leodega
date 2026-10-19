<?php

namespace Tests\Feature;

use App\Enums\OrganizationRole;
use App\Enums\WalletMovementType;
use App\Http\Resources\PanelMemberResource;
use App\Models\Organization;
use App\Models\OrganizationInvitation;
use App\Models\OrganizationWalletMovement;
use App\Models\Reservations;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Testing\TestResponse;
use Tests\TestCase;

/**
 * hue-03 U1a: GET /organizations/{organization}/panel/members (PAN-6, PAN-14,
 * PAN-15). A bare array in membership order; the server leaves out every key
 * the caller may not see, so a hidden key is absent and never null.
 */
class OrganizationPanelMembersTest extends TestCase
{
    use RefreshDatabase;

    private const BASE_KEYS = ['is_self', 'joined_at', 'name', 'role', 'user_id'];

    private Organization $organization;

    private User $admin;

    private User $second;

    private User $third;

    protected function setUp(): void
    {
        parent::setUp();

        Carbon::setTestNow('2026-10-10 12:00:00');

        $this->admin = $this->tenant();
        $this->second = $this->tenant();
        $this->third = $this->tenant();
        $this->organization = Organization::factory()
            ->withMember($this->admin, OrganizationRole::ADMIN)
            ->withMember($this->second, OrganizationRole::MEMBER, '100.00')
            ->withMember($this->third, OrganizationRole::MEMBER)
            ->create();
    }

    protected function tearDown(): void
    {
        Carbon::setTestNow();

        parent::tearDown();
    }

    private function tenant(): User
    {
        return User::factory()->create(['role' => 'tenant', 'state' => 'active']);
    }

    private function members(User $caller, ?Organization $organization = null): TestResponse
    {
        $organization ??= $this->organization;

        return $this->actingAs($caller, 'sanctum')->getJson("/api/organizations/{$organization->id}/panel/members");
    }

    private function row(TestResponse $response, User $user): array
    {
        return collect($response->json())->firstWhere('user_id', $user->id);
    }

    private function keys(array $row): array
    {
        $keys = array_keys($row);
        sort($keys);

        return $keys;
    }

    private function spend(User $user, string $type, string $amount, string $start): void
    {
        $reservation = Reservations::factory()->forOrganization($this->organization)->create([
            'start_date' => $start,
            'end_date' => Carbon::parse($start)->addDays(5)->toDateString(),
        ]);

        OrganizationWalletMovement::factory()->create([
            'organization_id' => $this->organization->id,
            'user_id' => $user->id,
            'reservation_id' => $reservation->id,
            'type' => $type,
            'amount' => $amount,
        ]);
    }

    // PAN-S30, PAN-S40
    public function test_the_response_is_a_bare_array_in_membership_order()
    {
        $response = $this->members($this->third)->assertOk();

        $this->assertTrue(array_is_list($response->json()));
        $this->assertSame(
            [$this->admin->id, $this->second->id, $this->third->id],
            array_column($response->json(), 'user_id')
        );
    }

    // PAN-S31
    public function test_admin_rows_carry_every_documented_key()
    {
        $response = $this->members($this->admin)->assertOk();

        foreach ($response->json() as $row) {
            $this->assertSame(
                ['email', 'is_self', 'joined_at', 'monthly_limit', 'name', 'role', 'spent', 'user_id'],
                $this->keys($row)
            );
        }
        $this->assertSame($this->second->email, $this->row($response, $this->second)['email']);
        $this->assertSame('member', $this->row($response, $this->second)['role']);
        $this->assertSame('admin', $this->row($response, $this->admin)['role']);
    }

    // PAN-S32, PAN-S87
    public function test_a_member_without_a_limit_has_the_key_present_as_null_and_a_two_decimal_spent()
    {
        $row = $this->row($this->members($this->admin)->assertOk(), $this->third);

        $this->assertArrayHasKey('monthly_limit', $row);
        $this->assertNull($row['monthly_limit']);
        $this->assertSame('0.00', $row['spent']);
    }

    // PAN-S33
    public function test_limit_and_spent_are_two_decimal_strings_for_the_current_month_only()
    {
        $this->spend($this->second, WalletMovementType::Reserva->value, '-40.00', '2026-10-15');
        $this->spend($this->second, WalletMovementType::Reserva->value, '-900.00', '2026-09-30');
        $this->spend($this->second, WalletMovementType::Reserva->value, '-700.00', '2026-11-01');

        $row = $this->row($this->members($this->admin)->assertOk(), $this->second);

        $this->assertSame('100.00', $row['monthly_limit']);
        $this->assertSame('40.00', $row['spent']);
    }

    // PAN-S34
    public function test_a_refund_nets_out_like_the_booking_guard()
    {
        $this->spend($this->second, WalletMovementType::Reserva->value, '-100.00', '2026-10-15');
        $this->spend($this->second, WalletMovementType::Reembolso->value, '100.00', '2026-10-15');
        $this->spend($this->third, WalletMovementType::Reserva->value, '-100.00', '2026-10-16');
        $this->spend($this->third, WalletMovementType::Reembolso->value, '60.00', '2026-10-16');

        $response = $this->members($this->admin)->assertOk();

        $this->assertSame('0.00', $this->row($response, $this->second)['spent']);
        $this->assertSame('40.00', $this->row($response, $this->third)['spent']);
    }

    // PAN-S35
    public function test_a_member_caller_sees_no_email_and_no_limit_or_spent_on_other_rows()
    {
        $this->spend($this->second, WalletMovementType::Reserva->value, '-40.00', '2026-10-15');

        $response = $this->members($this->third)->assertOk();

        $this->assertStringNotContainsString('email', $response->getContent());
        foreach ([$this->admin, $this->second] as $other) {
            $this->assertSame(self::BASE_KEYS, $this->keys($this->row($response, $other)));
        }
    }

    // PAN-S36
    public function test_a_member_caller_sees_own_limit_and_spent_and_is_self_marks_only_the_caller()
    {
        $this->spend($this->second, WalletMovementType::Reserva->value, '-40.00', '2026-10-15');
        $this->spend($this->third, WalletMovementType::Reserva->value, '-75.50', '2026-10-15');

        $own = $this->row($this->members($this->second)->assertOk(), $this->second);
        $response = $this->members($this->third)->assertOk();

        $this->assertSame(['is_self', 'joined_at', 'monthly_limit', 'name', 'role', 'spent', 'user_id'], $this->keys($own));
        $this->assertSame('100.00', $own['monthly_limit']);
        $this->assertSame('40.00', $own['spent']);
        $this->assertTrue($own['is_self']);

        $ownThird = $this->row($response, $this->third);
        $this->assertNull($ownThird['monthly_limit']);
        $this->assertSame('75.50', $ownThird['spent']);
        $this->assertSame(
            [false, false, true],
            array_column($response->json(), 'is_self')
        );
    }

    // PAN-S36 for admins: is_self exists on every row for every role
    public function test_is_self_marks_only_the_admin_caller_in_the_admin_view()
    {
        $response = $this->members($this->admin)->assertOk();

        $this->assertSame([true, false, false], array_column($response->json(), 'is_self'));
    }

    // PAN-S37
    public function test_a_pending_invitee_is_not_listed()
    {
        $invitee = $this->tenant();
        OrganizationInvitation::factory()->create([
            'organization_id' => $this->organization->id,
            'invited_user_id' => $invitee->id,
            'invited_by_user_id' => $this->admin->id,
            'email' => strtolower($invitee->email),
        ]);

        $ids = array_column($this->members($this->admin)->assertOk()->json(), 'user_id');

        $this->assertCount(3, $ids);
        $this->assertNotContains($invitee->id, $ids);
    }

    // PAN-S38, PAN-S78
    public function test_a_lone_creator_gets_an_array_of_one_row_marked_as_self()
    {
        $creator = $this->tenant();
        $solo = Organization::factory()->withMember($creator, OrganizationRole::ADMIN)->create();

        $response = $this->members($creator, $solo)->assertOk();

        $this->assertCount(1, $response->json());
        $this->assertTrue($response->json('0.is_self'));
        $this->assertSame($creator->id, $response->json('0.user_id'));
    }

    // PAN-S39, PAN-S86
    public function test_joined_at_is_the_pivot_time_as_iso_for_the_creator_and_every_invitee()
    {
        $this->organization->users()->updateExistingPivot($this->admin->id, ['joined_at' => '2026-09-01 08:30:00']);
        $this->organization->users()->updateExistingPivot($this->second->id, ['joined_at' => '2026-09-15 14:05:09']);

        $response = $this->members($this->admin)->assertOk();

        $this->assertSame(Carbon::parse('2026-09-01 08:30:00')->toISOString(), $this->row($response, $this->admin)['joined_at']);
        $this->assertSame(Carbon::parse('2026-09-15 14:05:09')->toISOString(), $this->row($response, $this->second)['joined_at']);
        $this->assertMatchesRegularExpression('/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z$/', $this->row($response, $this->third)['joined_at']);
    }

    // PAN-S39, legacy row. SQLite makes the pivot column NOT NULL, so the
    // tolerance is proven on the resource that shapes the row.
    public function test_a_legacy_row_without_a_join_time_maps_to_null()
    {
        $row = (new PanelMemberResource([
            'user_id' => 9, 'name' => 'Legacy', 'role' => 'member', 'joined_at' => null, 'is_self' => false,
        ]))->toArray(new Request);

        $this->assertArrayHasKey('joined_at', $row);
        $this->assertNull($row['joined_at']);
    }

    // PAN-S85
    public function test_a_stored_integer_limit_still_leaves_as_a_two_decimal_string()
    {
        DB::table('organization_user')
            ->where('organization_id', $this->organization->id)
            ->where('user_id', $this->third->id)
            ->update(['monthly_limit' => 250]);

        $this->assertSame('250.00', $this->row($this->members($this->admin)->assertOk(), $this->third)['monthly_limit']);
    }

    // PAN-S82, PAN-S83
    public function test_the_member_body_has_no_email_and_the_admin_body_has_it()
    {
        $this->assertStringNotContainsString('email', $this->members($this->second)->assertOk()->getContent());
        $this->assertStringContainsString('email', $this->members($this->admin)->assertOk()->getContent());
    }

    // PAN-S84
    public function test_an_admin_of_one_organization_gets_the_reduced_shape_where_they_are_a_member()
    {
        $other = Organization::factory()
            ->withMember($this->tenant(), OrganizationRole::ADMIN)
            ->withMember($this->admin, OrganizationRole::MEMBER)
            ->create();

        $reduced = $this->members($this->admin, $other)->assertOk();
        $full = $this->members($this->admin)->assertOk();

        $this->assertStringNotContainsString('email', $reduced->getContent());
        $this->assertStringContainsString('email', $full->getContent());
    }

    // PAN-S20 (members half)
    public function test_members_of_other_organizations_are_not_listed()
    {
        Organization::factory()->withMember($this->tenant(), OrganizationRole::ADMIN)->create();

        $this->assertCount(3, $this->members($this->admin)->assertOk()->json());
    }
}
