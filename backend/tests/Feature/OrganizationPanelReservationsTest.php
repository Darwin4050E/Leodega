<?php

namespace Tests\Feature;

use App\Enums\OrganizationRole;
use App\Enums\WalletMovementType;
use App\Models\Organization;
use App\Models\OrganizationWalletMovement;
use App\Models\Reservations;
use App\Models\StoreRooms;
use App\Models\Tenants;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Testing\TestResponse;
use Tests\TestCase;

/**
 * hue-03 U1b: GET /organizations/{organization}/panel/reservations (PAN-7,
 * PAN-11, PAN-12). Active reservations only, 20 per page, read-only; a member
 * sees only the ones they made, an admin sees the whole organization.
 */
class OrganizationPanelReservationsTest extends TestCase
{
    use RefreshDatabase;

    private const ROW_KEYS = ['end_date', 'id', 'member_name', 'paid_with_wallet', 'start_date', 'status', 'total', 'warehouse_name'];

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

    private function reservations(User $caller, ?Organization $organization = null, string $query = ''): TestResponse
    {
        $organization ??= $this->organization;

        return $this->actingAs($caller, 'sanctum')->getJson("/api/organizations/{$organization->id}/panel/reservations{$query}");
    }

    private function summary(User $caller): TestResponse
    {
        return $this->actingAs($caller, 'sanctum')->getJson("/api/organizations/{$this->organization->id}/panel/summary");
    }

    private function reservation(array $attributes = [], ?User $by = null, ?Organization $organization = null): Reservations
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

    private function ids(TestResponse $response): array
    {
        return collect($response->json('data'))->pluck('id')->all();
    }

    // PAN-S41
    public function test_an_admin_sees_every_active_reservation_with_member_total_and_wallet_flag()
    {
        $room = StoreRooms::factory()->create(['title' => 'Bodega Norte']);
        $byAdmin = $this->reservation(['store_room_id' => $room->id, 'total_mount' => '120.50'], $this->admin);
        $byMember = $this->reservation(['start_date' => '2026-10-14'], $this->member);
        $third = $this->reservation(['start_date' => '2026-10-16'], $this->tenant());

        $response = $this->reservations($this->admin)->assertOk();

        $this->assertSame([$byAdmin->id, $byMember->id, $third->id], $this->ids($response));
        $first = $response->json('data.0');
        $this->assertSame(self::ROW_KEYS, collect($first)->keys()->sort()->values()->all());
        $this->assertSame('Bodega Norte', $first['warehouse_name']);
        $this->assertSame($this->admin->name, $first['member_name']);
        $this->assertSame('120.50', $first['total']);
        $this->assertFalse($first['paid_with_wallet']);
        $this->assertSame($this->member->name, $response->json('data.1.member_name'));
    }

    // PAN-S42, Q1 a
    public function test_a_member_sees_only_the_reservations_they_made()
    {
        $this->reservation([], $this->admin);
        $mine = $this->reservation(['start_date' => '2026-10-14'], $this->member);
        $this->reservation(['start_date' => '2026-10-16'], $this->tenant());

        $response = $this->reservations($this->member)->assertOk();

        $this->assertSame([$mine->id], $this->ids($response));
        $response->assertJsonPath('total', 1);
    }

    // PAN-S42, a member who made none while others exist
    public function test_a_member_without_reservations_gets_an_empty_page_while_others_exist()
    {
        $this->reservation([], $this->admin);

        $this->reservations($this->member)->assertOk()
            ->assertJsonPath('data', [])
            ->assertJsonPath('total', 0);
    }

    // PAN-S43
    public function test_forty_five_reservations_page_as_20_20_5_with_the_real_total()
    {
        foreach (range(1, 45) as $day) {
            $this->reservation(['start_date' => Carbon::parse('2026-10-11')->addDays($day)->toDateString(), 'end_date' => '2026-12-31'], $this->admin);
        }

        foreach ([1 => 20, 2 => 20, 3 => 5] as $page => $size) {
            $response = $this->reservations($this->admin, null, "?page={$page}")->assertOk();

            $this->assertCount($size, $response->json('data'));
            $response->assertJsonPath('total', 45)
                ->assertJsonPath('last_page', 3)
                ->assertJsonPath('per_page', 20)
                ->assertJsonPath('current_page', $page);
        }
    }

    // PAN-S44
    public function test_a_page_past_the_end_is_empty_with_the_real_total()
    {
        foreach (range(1, 45) as $day) {
            $this->reservation(['end_date' => '2026-12-31'], $this->admin);
        }

        $this->reservations($this->admin, null, '?page=4')->assertOk()
            ->assertJsonPath('data', [])
            ->assertJsonPath('total', 45)
            ->assertJsonPath('last_page', 3);
    }

    // PAN-S45
    public function test_an_invalid_page_falls_back_to_page_one()
    {
        $this->reservation([], $this->admin);

        foreach (['0', '-1', 'abc'] as $page) {
            $this->reservations($this->admin, null, "?page={$page}")->assertOk()
                ->assertJsonPath('current_page', 1)
                ->assertJsonCount(1, 'data');
        }
    }

    // PAN-S46
    public function test_reservations_are_ordered_by_start_date_then_id_and_stay_stable_across_pages()
    {
        $later = $this->reservation(['start_date' => '2026-11-30', 'end_date' => '2026-12-31'], $this->admin);
        $expected = [];
        foreach (range(1, 24) as $_) {
            $expected[] = $this->reservation(['start_date' => '2026-10-15'], $this->admin)->id;
        }
        $expected[] = $later->id;

        DB::enableQueryLog();
        $pageOne = $this->ids($this->reservations($this->admin));
        $pageQuery = collect(DB::getQueryLog())->pluck('query')->first(fn (string $sql) => str_contains($sql, 'from "reservations"') && str_contains($sql, 'limit'));
        $pageTwo = $this->ids($this->reservations($this->admin, null, '?page=2'));

        $this->assertSame($expected, [...$pageOne, ...$pageTwo]);
        $this->assertStringContainsString('order by "start_date" asc, "id" asc', $pageQuery);
    }

    // PAN-S47
    public function test_a_wallet_paid_reservation_is_flagged_and_an_unpaid_one_is_not()
    {
        $paid = $this->reservation([], $this->admin);
        $unpaid = $this->reservation(['start_date' => '2026-10-14'], $this->admin);
        $refundedOnly = $this->reservation(['start_date' => '2026-10-16'], $this->admin);
        OrganizationWalletMovement::factory()->create([
            'organization_id' => $this->organization->id,
            'reservation_id' => $paid->id,
            'type' => WalletMovementType::Reserva,
            'amount' => '-100.00',
        ]);
        OrganizationWalletMovement::factory()->create([
            'organization_id' => $this->organization->id,
            'reservation_id' => $refundedOnly->id,
            'type' => WalletMovementType::Reembolso,
            'amount' => '50.00',
        ]);

        $rows = collect($this->reservations($this->admin)->assertOk()->json('data'))->keyBy('id');

        $this->assertTrue($rows[$paid->id]['paid_with_wallet']);
        $this->assertFalse($rows[$unpaid->id]['paid_with_wallet']);
        $this->assertFalse($rows[$refundedOnly->id]['paid_with_wallet']);
    }

    // PAN-S48, soft deleted warehouse
    public function test_a_soft_deleted_warehouse_leaves_a_null_name_and_no_error()
    {
        $room = StoreRooms::factory()->create(['title' => 'Bodega Vieja']);
        $this->reservation(['store_room_id' => $room->id], $this->admin);
        $room->delete();

        $this->reservations($this->admin)->assertOk()
            ->assertJsonPath('data.0.warehouse_name', null)
            ->assertJsonPath('data.0.member_name', $this->admin->name);
    }

    // PAN-S48, rows whose warehouse or creator are physically gone
    public function test_a_hard_deleted_warehouse_or_creator_leaves_null_names_and_no_error()
    {
        $orphanRoom = $this->reservation([], $this->admin);
        $tenant = Tenants::factory()->create();
        $orphanTenant = $this->reservation(['start_date' => '2026-10-14', 'tenant_id' => $tenant->id]);

        DB::statement('PRAGMA defer_foreign_keys = ON');
        DB::table('reservations')->where('id', $orphanRoom->id)->update(['store_room_id' => 999999]);
        DB::table('tenants')->where('id', $tenant->id)->update(['user_id' => 999999]);

        $rows = collect($this->reservations($this->admin)->assertOk()->json('data'))->keyBy('id');

        $this->assertNull($rows[$orphanRoom->id]['warehouse_name']);
        $this->assertSame($this->admin->name, $rows[$orphanRoom->id]['member_name']);
        $this->assertNull($rows[$orphanTenant->id]['member_name']);
        $this->assertNotNull($rows[$orphanTenant->id]['warehouse_name']);
    }

    // PAN-S49
    public function test_no_cancel_or_permission_flag_is_present()
    {
        $this->reservation([], $this->admin);

        $content = $this->reservations($this->admin)->assertOk()->getContent();

        foreach (['can_be_cancelled', 'cancel', 'can_'] as $needle) {
            $this->assertStringNotContainsString($needle, $content);
        }
    }

    // PAN-S50, PAN-S27
    public function test_an_expired_hold_is_absent_and_nothing_is_written()
    {
        $held = $this->reservation(['status' => 'pending', 'created_at' => now()->subMinutes(5)], $this->admin);
        $expired = $this->reservation(['status' => 'pending', 'created_at' => now()->subMinutes(45)], $this->admin);
        $before = DB::table('reservations')->orderBy('id')->get()->all();

        $response = $this->reservations($this->admin)->assertOk();

        $this->assertSame([$held->id], $this->ids($response));
        $response->assertJsonPath('data.0.status', 'pending');
        $this->assertEquals($before, DB::table('reservations')->orderBy('id')->get()->all());
        $this->assertSame('pending', DB::table('reservations')->where('id', $expired->id)->value('status'));
    }

    // PAN-S23..S28 through the table
    public function test_canceled_ended_personal_and_foreign_reservations_are_not_listed()
    {
        $kept = $this->reservation(['end_date' => '2026-10-10'], $this->admin);
        $this->reservation(['status' => 'canceled'], $this->admin);
        $this->reservation(['start_date' => '2026-10-01', 'end_date' => '2026-10-09'], $this->admin);
        $this->reservation([], $this->admin, Organization::factory()->create());
        Reservations::factory()->create([
            'tenant_id' => $this->admin->tenant->id,
            'start_date' => '2026-10-12',
            'end_date' => '2026-10-20',
        ]);

        $this->assertSame([$kept->id], $this->ids($this->reservations($this->admin)->assertOk()));
    }

    // PAN-S75
    public function test_an_organization_without_reservations_answers_an_empty_page()
    {
        $this->reservations($this->admin)->assertOk()
            ->assertJsonPath('data', [])
            ->assertJsonPath('total', 0)
            ->assertJsonPath('last_page', 1)
            ->assertJsonPath('current_page', 1);
    }

    // PAN-S29
    public function test_the_summary_card_equals_the_table_total_for_the_admin_and_the_member()
    {
        $this->reservation([], $this->admin);
        $this->reservation(['start_date' => '2026-10-14'], $this->member);
        $this->reservation(['start_date' => '2026-10-16'], $this->member);
        $this->reservation(['status' => 'pending', 'created_at' => now()->subMinutes(45)], $this->member);
        $this->reservation(['status' => 'canceled'], $this->member);

        foreach ([[$this->admin, 3], [$this->member, 2]] as [$caller, $expected]) {
            $this->assertSame($expected, $this->reservations($caller)->json('total'));
            $this->assertSame($expected, $this->summary($caller)->json('active_reservations_count'));
        }
    }

    // PAN-S85, PAN-S86
    public function test_money_is_a_two_decimal_string_and_dates_are_plain_calendar_dates()
    {
        $this->reservation(['total_mount' => '99.5', 'start_date' => '2026-10-12 08:30:00', 'end_date' => '2026-10-20 00:00:00'], $this->admin);

        $row = $this->reservations($this->admin)->assertOk()->json('data.0');

        $this->assertSame('99.50', $row['total']);
        $this->assertSame('2026-10-12', $row['start_date']);
        $this->assertSame('2026-10-20', $row['end_date']);
    }

    // PAN-S82, Q1 a
    public function test_the_member_body_has_no_email_and_keeps_total_and_the_wallet_flag()
    {
        $this->reservation(['total_mount' => '75.00'], $this->member);

        $response = $this->reservations($this->member)->assertOk();

        $this->assertStringNotContainsString('email', $response->getContent());
        $response->assertJsonPath('data.0.total', '75.00')->assertJsonPath('data.0.paid_with_wallet', false);
    }

    // PAN-S29 context: a role is per organization
    public function test_the_scope_follows_the_role_in_each_organization()
    {
        $other = Organization::factory()->withMember($this->admin, OrganizationRole::MEMBER)->create();
        $this->reservation([], $this->member);
        $mineInOther = $this->reservation([], $this->admin, $other);
        $this->reservation([], $this->tenant(), $other);

        $this->assertSame([$mineInOther->id], $this->ids($this->reservations($this->admin, $other)->assertOk()));
        $this->assertCount(1, $this->reservations($this->admin)->assertOk()->json('data'));
    }

    public function test_the_query_count_does_not_grow_with_the_page_size()
    {
        $this->reservation([], $this->admin);
        $this->reservation(['start_date' => '2026-10-14'], $this->member);
        DB::enableQueryLog();
        $this->reservations($this->admin)->assertOk();
        $small = count(DB::getQueryLog());

        foreach (range(1, 18) as $_) {
            $this->reservation([], $this->tenant());
        }
        DB::flushQueryLog();
        $response = $this->reservations($this->admin)->assertOk();

        $this->assertCount(20, $response->json('data'));
        $this->assertSame($small, count(DB::getQueryLog()));
    }
}
