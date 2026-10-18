<?php

namespace Tests\Feature;

use App\Enums\OrganizationRole;
use App\Models\Organization;
use App\Models\OrganizationReservationEvent;
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
 * hue-03 U1c: GET /organizations/{organization}/panel/history (PAN-8..PAN-12).
 * The feed is derived at read time from reservations, cancel events, wallet
 * movements and the membership pivot; nothing is stored for it.
 */
class OrganizationPanelHistoryTest extends TestCase
{
    use RefreshDatabase;

    private const ROW_KEYS = ['actor_name', 'amount', 'id', 'kind', 'occurred_at', 'target_label'];

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
        // Old joins keep the two member_joined rows at the bottom of the feed.
        $this->organization->users()->updateExistingPivot($this->admin->id, ['joined_at' => '2026-01-01 08:00:00']);
        $this->organization->users()->updateExistingPivot($this->member->id, ['joined_at' => '2026-01-02 08:00:00']);
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

    private function history(string $query = '', ?Organization $organization = null): TestResponse
    {
        $organization ??= $this->organization;

        return $this->actingAs($this->admin, 'sanctum')->getJson("/api/organizations/{$organization->id}/panel/history{$query}");
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
            'created_at' => '2026-10-05 09:00:00',
        ]);
    }

    private function movement(string $type, string $at, string $amount = '100.00', ?User $by = null, ?Reservations $reservation = null, ?Organization $organization = null): OrganizationWalletMovement
    {
        return OrganizationWalletMovement::factory()->create([
            'organization_id' => ($organization ?? $this->organization)->id,
            'user_id' => $by?->id,
            'reservation_id' => $reservation?->id,
            'type' => $type,
            'amount' => $amount,
            'created_at' => $at,
        ]);
    }

    private function cancelEvent(Reservations $reservation, string $at, ?User $by = null, ?Organization $organization = null): OrganizationReservationEvent
    {
        return OrganizationReservationEvent::factory()->cancelled()->create([
            'organization_id' => ($organization ?? $this->organization)->id,
            'reservation_id' => $reservation->id,
            'actor_user_id' => $by?->id,
            'created_at' => $at,
        ]);
    }

    private function ids(TestResponse $response): array
    {
        return collect($response->json('data'))->pluck('id')->all();
    }

    private function ofKind(TestResponse $response, string $kind): array
    {
        return collect($response->json('data'))->where('kind', $kind)->values()->all();
    }

    // PAN-S52
    public function test_a_reservation_yields_a_created_row_with_actor_warehouse_and_total()
    {
        $room = StoreRooms::factory()->create(['title' => 'Bodega Norte']);
        $reservation = $this->reservation(['store_room_id' => $room->id, 'total_mount' => '120.5'], $this->member);

        $rows = $this->ofKind($this->history()->assertOk(), 'reservation_created');

        $this->assertCount(1, $rows);
        $this->assertSame(self::ROW_KEYS, collect($rows[0])->keys()->sort()->values()->all());
        $this->assertSame("reservation_created:{$reservation->id}", $rows[0]['id']);
        $this->assertSame(Carbon::parse('2026-10-05 09:00:00')->toISOString(), $rows[0]['occurred_at']);
        $this->assertSame($this->member->name, $rows[0]['actor_name']);
        $this->assertSame('Bodega Norte', $rows[0]['target_label']);
        $this->assertSame('120.50', $rows[0]['amount']);
    }

    // PAN-S53
    public function test_a_cancel_event_yields_a_cancelled_row_with_actor_and_warehouse()
    {
        $room = StoreRooms::factory()->create(['title' => 'Bodega Sur']);
        $reservation = $this->reservation(['store_room_id' => $room->id, 'status' => 'canceled'], $this->member);
        $event = $this->cancelEvent($reservation, '2026-10-06 10:00:00', $this->member);

        $rows = $this->ofKind($this->history(), 'reservation_cancelled');

        $this->assertCount(1, $rows);
        $this->assertSame("reservation_cancelled:{$event->id}", $rows[0]['id']);
        $this->assertSame(Carbon::parse('2026-10-06 10:00:00')->toISOString(), $rows[0]['occurred_at']);
        $this->assertSame($this->member->name, $rows[0]['actor_name']);
        $this->assertSame('Bodega Sur', $rows[0]['target_label']);
        $this->assertNull($rows[0]['amount']);
    }

    // PAN-S54
    public function test_a_topup_yields_a_row_with_the_amount_and_no_target()
    {
        $movement = $this->movement('recarga', '2026-10-07 11:00:00', '150.00', $this->admin);

        $rows = $this->ofKind($this->history(), 'wallet_topup');

        $this->assertCount(1, $rows);
        $this->assertSame("wallet_topup:{$movement->id}", $rows[0]['id']);
        $this->assertSame($this->admin->name, $rows[0]['actor_name']);
        $this->assertSame('150.00', $rows[0]['amount']);
        $this->assertNull($rows[0]['target_label']);
    }

    // PAN-S55
    public function test_a_refund_yields_a_positive_amount_with_the_warehouse_title()
    {
        $room = StoreRooms::factory()->create(['title' => 'Bodega Este']);
        $reservation = $this->reservation(['store_room_id' => $room->id, 'status' => 'canceled'], $this->member);
        $movement = $this->movement('reembolso', '2026-10-06 10:00:00', '90.00', $this->member, $reservation);

        $rows = $this->ofKind($this->history(), 'wallet_refund');

        $this->assertCount(1, $rows);
        $this->assertSame("wallet_refund:{$movement->id}", $rows[0]['id']);
        $this->assertSame($this->member->name, $rows[0]['actor_name']);
        $this->assertSame('90.00', $rows[0]['amount']);
        $this->assertSame('Bodega Este', $rows[0]['target_label']);
    }

    // PAN-S56
    public function test_the_creator_and_each_member_yield_a_member_joined_row()
    {
        $rows = $this->ofKind($this->history(), 'member_joined');

        $this->assertCount(2, $rows);
        $this->assertSame([$this->member->name, $this->admin->name], array_column($rows, 'actor_name'));
        $this->assertSame([null, null], array_column($rows, 'amount'));
        $this->assertSame([null, null], array_column($rows, 'target_label'));
        $this->assertSame(Carbon::parse('2026-01-02 08:00:00')->toISOString(), $rows[0]['occurred_at']);
    }

    // PAN-S57
    public function test_a_wallet_debit_produces_no_row()
    {
        $reservation = $this->reservation([], $this->member);
        $this->movement('reserva', '2026-10-05 09:00:01', '-120.00', $this->member, $reservation);

        $response = $this->history();

        $this->assertSame(['reservation_created', 'member_joined', 'member_joined'], array_column($response->json('data'), 'kind'));
    }

    // PAN-S58
    public function test_a_denied_attempt_produces_no_row()
    {
        $reservation = $this->reservation([], $this->member);
        OrganizationReservationEvent::factory()->deniedAttempt()->create([
            'organization_id' => $this->organization->id,
            'reservation_id' => $reservation->id,
            'actor_user_id' => $this->member->id,
            'created_at' => '2026-10-06 10:00:00',
        ]);

        $this->assertSame([], $this->ofKind($this->history(), 'reservation_cancelled'));
        $this->history()->assertJsonPath('total', 3);
    }

    // PAN-S59
    public function test_row_ids_are_kind_and_source_id_unique_and_stable()
    {
        $reservation = $this->reservation([], $this->member);
        $this->cancelEvent($reservation, '2026-10-06 10:00:00', $this->member);
        $this->movement('recarga', '2026-10-07 11:00:00', '10.00', $this->admin);
        $this->movement('reembolso', '2026-10-06 10:00:00', '5.00', $this->member, $reservation);

        $first = $this->ids($this->history());
        $second = $this->ids($this->history());

        $this->assertCount(6, $first);
        $this->assertSame($first, array_unique($first));
        $this->assertSame($first, $second);
        foreach ($first as $id) {
            $this->assertMatchesRegularExpression('/^(reservation_created|reservation_cancelled|wallet_topup|wallet_refund|member_joined):\d+$/', $id);
        }
    }

    // PAN-S60
    public function test_no_row_leaks_an_email()
    {
        $this->reservation([], $this->member);
        $this->movement('recarga', '2026-10-07 11:00:00', '10.00', $this->admin);

        $response = $this->history();

        $this->assertStringNotContainsString('email', $response->getContent());
        $this->assertStringNotContainsString($this->admin->email, $response->getContent());
        $this->assertStringNotContainsString($this->member->email, $response->getContent());
    }

    // PAN-S61, PAN-S70
    public function test_rows_of_other_organizations_never_appear()
    {
        $other = Organization::factory()->withMember($this->tenant(), OrganizationRole::ADMIN)->create();
        $foreign = $this->reservation([], null, $other);
        $this->cancelEvent($foreign, '2026-10-06 10:00:00', null, $other);
        $this->movement('recarga', '2026-10-07 11:00:00', '99.00', null, null, $other);
        $this->movement('reembolso', '2026-10-07 11:00:00', '99.00', null, $foreign, $other);

        $response = $this->history()->assertOk();

        $this->assertSame(['member_joined', 'member_joined'], array_column($response->json('data'), 'kind'));
    }

    // Q7 a
    public function test_a_created_row_exists_for_every_status()
    {
        $this->reservation(['status' => 'confirmed']);
        $this->reservation(['status' => 'canceled']);
        $this->reservation(['status' => 'pending', 'created_at' => now()->subHours(3)]);
        $this->reservation(['status' => 'confirmed', 'start_date' => '2026-01-01', 'end_date' => '2026-01-05']);

        $this->assertCount(4, $this->ofKind($this->history(), 'reservation_created'));
    }

    // Q4 a
    public function test_a_landlord_cancel_leaves_no_cancelled_row_and_the_refund_is_the_trace()
    {
        $reservation = $this->reservation(['status' => 'canceled'], $this->member);
        $this->movement('reembolso', '2026-10-06 10:00:00', '90.00', $this->member, $reservation);

        $response = $this->history();

        $this->assertSame([], $this->ofKind($response, 'reservation_cancelled'));
        $this->assertCount(1, $this->ofKind($response, 'wallet_refund'));
    }

    // Q6 a
    public function test_a_cancel_with_a_refund_is_two_rows()
    {
        $reservation = $this->reservation(['status' => 'canceled'], $this->member);
        $this->cancelEvent($reservation, '2026-10-06 10:00:00', $this->admin);
        $this->movement('reembolso', '2026-10-06 10:00:00', '90.00', $this->member, $reservation);

        $this->assertSame(
            ['wallet_refund', 'reservation_cancelled', 'reservation_created', 'member_joined', 'member_joined'],
            array_column($this->history()->json('data'), 'kind')
        );
    }

    // PAN-S62
    public function test_rows_from_different_sources_interleave_newest_first()
    {
        $reservation = $this->reservation(['created_at' => '2026-10-02 09:00:00'], $this->member);
        $topup = $this->movement('recarga', '2026-10-03 09:00:00', '10.00', $this->admin);
        $event = $this->cancelEvent($reservation, '2026-10-04 09:00:00', $this->member);
        $refund = $this->movement('reembolso', '2026-10-05 09:00:00', '5.00', $this->member, $reservation);

        $this->assertSame(
            ["wallet_refund:{$refund->id}", "reservation_cancelled:{$event->id}", "wallet_topup:{$topup->id}", "reservation_created:{$reservation->id}"],
            array_slice($this->ids($this->history()), 0, 4)
        );
    }

    // PAN-S63
    public function test_rows_at_the_same_instant_follow_the_precedence()
    {
        $at = '2026-10-06 10:00:00';
        $reservation = $this->reservation(['created_at' => $at], $this->member);
        $event = $this->cancelEvent($reservation, $at, $this->member);
        $refund = $this->movement('reembolso', $at, '5.00', $this->member, $reservation);
        $topup = $this->movement('recarga', $at, '10.00', $this->admin);
        $this->organization->users()->updateExistingPivot($this->admin->id, ['joined_at' => $at]);

        $this->assertSame(
            ["wallet_refund:{$refund->id}", "reservation_cancelled:{$event->id}", "wallet_topup:{$topup->id}", "reservation_created:{$reservation->id}"],
            array_slice($this->ids($this->history()), 0, 4)
        );
        $this->assertSame('member_joined', $this->history()->json('data.4.kind'));
    }

    // PAN-S64
    public function test_two_topups_at_the_same_instant_put_the_higher_id_first()
    {
        $first = $this->movement('recarga', '2026-10-06 10:00:00', '10.00', $this->admin);
        $second = $this->movement('recarga', '2026-10-06 10:00:00', '20.00', $this->admin);

        $this->assertSame(
            ["wallet_topup:{$second->id}", "wallet_topup:{$first->id}"],
            array_slice($this->ids($this->history()), 0, 2)
        );
    }

    // PAN-S65, PAN-S66
    public function test_equal_instants_across_pages_neither_repeat_nor_skip_and_reads_are_identical()
    {
        $expected = [];
        foreach (range(1, 23) as $_) {
            $expected[] = 'wallet_topup:'.$this->movement('recarga', '2026-10-06 10:00:00', '1.00', $this->admin)->id;
        }

        $pageOne = $this->history('?page=1');
        $pageTwo = $this->history('?page=2');
        $seen = [...$this->ids($pageOne), ...$this->ids($pageTwo)];

        $this->assertCount(25, $seen);
        $this->assertSame($seen, array_unique($seen));
        $this->assertEqualsCanonicalizing($expected, array_filter($seen, fn (string $id) => str_starts_with($id, 'wallet_topup:')));
        $this->assertSame($pageOne->getContent(), $this->history('?page=1')->getContent());
        $this->assertSame($pageTwo->getContent(), $this->history('?page=2')->getContent());
    }

    // PAN-S67
    public function test_a_hard_deleted_actor_leaves_a_null_actor_name()
    {
        $this->movement('recarga', '2026-10-07 11:00:00', '10.00', null);
        $reservation = $this->reservation(['tenant_id' => $this->member->tenant->id]);
        $this->cancelEvent($reservation, '2026-10-08 11:00:00', null);

        $response = $this->history()->assertOk();

        $this->assertNull($this->ofKind($response, 'wallet_topup')[0]['actor_name']);
        $this->assertNull($this->ofKind($response, 'reservation_cancelled')[0]['actor_name']);
    }

    // PAN-S68
    public function test_a_missing_reservation_or_warehouse_leaves_a_null_target()
    {
        $this->movement('reembolso', '2026-10-07 11:00:00', '10.00', $this->member, null);
        $room = StoreRooms::factory()->create();
        $this->reservation(['store_room_id' => $room->id], $this->member);
        $room->delete();

        $response = $this->history()->assertOk();

        $this->assertNull($this->ofKind($response, 'wallet_refund')[0]['target_label']);
        $this->assertNull($this->ofKind($response, 'reservation_created')[0]['target_label']);
    }

    // PAN-S69: SQLite cannot hold a NULL joined_at, so the guard is asserted on the SQL
    public function test_a_membership_without_a_join_time_is_excluded_by_the_query()
    {
        DB::enableQueryLog();
        $this->history()->assertOk();
        $sql = collect(DB::getQueryLog())->pluck('query')->implode("\n");
        DB::disableQueryLog();

        $this->assertStringContainsString('"joined_at" is not null', $sql);
    }

    // PAN-S71
    public function test_sixty_one_rows_page_as_twenty_twenty_twenty_one()
    {
        foreach (range(1, 59) as $minute) {
            $this->movement('recarga', Carbon::parse('2026-10-06 00:00:00')->addMinutes($minute)->toDateTimeString(), '1.00', $this->admin);
        }

        $sizes = [];
        foreach (range(1, 4) as $page) {
            $response = $this->history("?page={$page}")->assertOk();
            $sizes[] = count($response->json('data'));
            $response->assertJsonPath('total', 61)->assertJsonPath('last_page', 4)->assertJsonPath('per_page', 20)->assertJsonPath('current_page', $page);
        }

        $this->assertSame([20, 20, 20, 1], $sizes);
    }

    // PAN-S72
    public function test_a_page_past_the_end_is_empty_with_the_real_totals()
    {
        $this->history('?page=9')
            ->assertOk()
            ->assertJsonPath('data', [])
            ->assertJsonPath('total', 2)
            ->assertJsonPath('last_page', 1);
    }

    // PAN-S73
    public function test_an_invalid_page_is_page_one()
    {
        foreach (['0', '-1', 'abc'] as $page) {
            $this->history("?page={$page}")->assertOk()->assertJsonPath('current_page', 1)->assertJsonCount(2, 'data');
        }
    }

    // PAN-S76, PAN-S77
    public function test_an_organization_with_only_its_creator_has_one_member_joined_row()
    {
        $solo = Organization::factory()->withMember($this->admin, OrganizationRole::ADMIN)->create();

        $response = $this->history('', $solo)->assertOk();

        $this->assertSame(['member_joined'], array_column($response->json('data'), 'kind'));
        $this->assertSame($this->admin->name, $response->json('data.0.actor_name'));
        $response->assertJsonPath('total', 1);
    }

    // PAN-S85, PAN-S86
    public function test_money_is_a_two_decimal_string_and_times_are_iso()
    {
        $this->reservation(['total_mount' => 80], $this->member);
        $this->movement('recarga', '2026-10-07 11:00:00', '7.5', $this->admin);

        $response = $this->history();

        foreach ($response->json('data') as $row) {
            $this->assertMatchesRegularExpression('/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z$/', $row['occurred_at']);
            if ($row['amount'] !== null) {
                $this->assertMatchesRegularExpression('/^\d+\.\d{2}$/', $row['amount']);
            }
        }
        $this->assertSame('80.00', $this->ofKind($response, 'reservation_created')[0]['amount']);
        $this->assertSame('7.50', $this->ofKind($response, 'wallet_topup')[0]['amount']);
    }
}
