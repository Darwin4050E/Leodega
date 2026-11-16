<?php

namespace Tests\Feature;

use App\Enums\OrganizationRole;
use App\Enums\WalletMovementType;
use App\Models\Landlords;
use App\Models\Organization;
use App\Models\OrganizationWalletMovement;
use App\Models\Reservations;
use App\Models\StorePrices;
use App\Models\StoreRooms;
use App\Models\Tenants;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Notification;
use Illuminate\Testing\TestResponse;
use Tests\TestCase;

/**
 * member-spending-limit U1a: the guard on `POST /api/reservations` in
 * organization context (ML-3..ML-12, OW-S52). Time is frozen inside October
 * 2026 so month membership and cancellation tiers are deterministic. A room
 * is priced per month and booked for one month unless a test says otherwise,
 * so the room price is the reservation total.
 */
class MemberSpendingLimitGuardTest extends TestCase
{
    use RefreshDatabase;

    private const LIMIT_MESSAGE = 'Esta reserva supera tu límite mensual. Pide a un administrador que lo aumente.';

    private const INSUFFICIENT = 'Saldo insuficiente en la organización';

    protected function setUp(): void
    {
        parent::setUp();

        Carbon::setTestNow('2026-10-10 12:00:00');
        Notification::fake();
    }

    private function org(string $balance = '50000.00'): Organization
    {
        return Organization::factory()->withBalance($balance)->create();
    }

    private function member(Organization $organization, ?string $limit = null, OrganizationRole $role = OrganizationRole::MEMBER): User
    {
        $user = User::factory()->create(['role' => 'tenant']);
        Tenants::factory()->create(['user_id' => $user->id]);
        $organization->users()->attach($user->id, ['role' => $role->value, 'monthly_limit' => $limit]);

        return $user;
    }

    private function setLimit(Organization $organization, User $user, ?string $limit): void
    {
        $organization->users()->updateExistingPivot($user->id, ['monthly_limit' => $limit]);
    }

    private function room(string $price = '1000.00', string $tier = 'flexible', ?Landlords $landlord = null): StoreRooms
    {
        $room = StoreRooms::factory()->approved()->create(array_filter([
            'cancellation_policy_tier' => $tier,
            'landlord_id' => $landlord?->id,
        ]));
        StorePrices::factory()->create([
            'store_room_id' => $room->id,
            'mode' => 'month',
            'price' => $price,
            'disponibility' => true,
        ]);

        return $room;
    }

    private function bookOn(User $user, StoreRooms $room, ?Organization $organization, string $start, int $months = 1): TestResponse
    {
        return $this->actingAs($user, 'sanctum')->postJson('/api/reservations', [
            'store_room_id' => $room->id,
            'start_date' => $start,
            'end_date' => Carbon::parse($start)->addMonths($months)->toDateString(),
        ], $organization ? ['X-Organization-Id' => (string) $organization->id] : []);
    }

    /** Starts 2026-11-01 + $monthsAhead months (Nov by default). */
    private function book(User $user, StoreRooms $room, Organization $organization, int $monthsAhead = 0, int $months = 1): TestResponse
    {
        return $this->bookOn($user, $room, $organization, Carbon::parse('2026-11-01')->addMonths($monthsAhead)->toDateString(), $months);
    }

    private function assertLimitRejected(TestResponse $response): void
    {
        $response->assertStatus(422);
        $response->assertJsonPath('errors.monthly_limit.0', self::LIMIT_MESSAGE);
        $response->assertJsonPath('message', self::LIMIT_MESSAGE);
        $this->assertSame(['message', 'errors'], array_keys($response->json()));
        $this->assertSame(['monthly_limit'], array_keys($response->json('errors')));
    }

    private function counts(): array
    {
        return [
            Reservations::count(),
            DB::table('payments')->count(),
            OrganizationWalletMovement::count(),
            DB::table('notifications')->count(),
        ];
    }

    private function tenantCancel(User $user, string $reservationId)
    {
        return $this->actingAs($user, 'sanctum')->patchJson("/api/tenant/reservations/{$reservationId}/cancel", ['reason' => 'Ya no la necesito']);
    }

    /** HUE-06: only an organization admin can cancel an organization reservation. */
    private function adminCancel(Organization $organization, string $reservationId)
    {
        return $this->tenantCancel($this->member($organization, null, OrganizationRole::ADMIN), $reservationId);
    }

    // -- ML-3: the rule --

    public function test_an_unlimited_member_books_any_total()
    {
        $organization = $this->org();
        $user = $this->member($organization, null);

        $this->book($user, $this->room('9000.00'), $organization)->assertStatus(201);
    }

    public function test_a_total_under_the_limit_is_accepted()
    {
        $organization = $this->org();
        $user = $this->member($organization, '1000.00');

        $this->book($user, $this->room('600.00'), $organization)->assertStatus(201);
    }

    public function test_a_total_that_reaches_the_limit_exactly_is_accepted_and_one_cent_more_is_not()
    {
        $organization = $this->org();
        $user = $this->member($organization, '1000.00');

        $this->book($user, $this->room('600.00'), $organization, 0)->assertStatus(201);
        $this->book($user, $this->room('400.00'), $organization, 0)->assertStatus(201);
        $this->assertLimitRejected($this->book($user, $this->room('0.01'), $organization, 0));

        $this->assertSame(2, Reservations::count());
    }

    public function test_a_single_total_equal_to_the_limit_passes_and_one_cent_over_is_rejected()
    {
        $organization = $this->org();
        $user = $this->member($organization, '1000.00');

        $this->assertLimitRejected($this->book($user, $this->room('1000.01'), $organization));
        $this->book($user, $this->room('1000.00'), $organization)->assertStatus(201);
    }

    public function test_the_rejection_is_the_same_for_an_admin_and_a_member_and_an_admin_can_limit_themselves()
    {
        $organization = $this->org();
        $admin = $this->member($organization, null, OrganizationRole::ADMIN);
        $member = $this->member($organization, '500.00');
        $room = $this->room('600.00');

        $memberBody = $this->book($member, $room, $organization);
        $this->assertLimitRejected($memberBody);

        $this->book($admin, $room, $organization)->assertStatus(201);
        $this->setLimit($organization, $admin, '500.00');
        $adminBody = $this->book($admin, $this->room('600.00'), $organization);
        $this->assertLimitRejected($adminBody);
        $this->assertSame($memberBody->json(), $adminBody->json());
    }

    public function test_a_personal_reservation_is_never_checked()
    {
        $organization = $this->org();
        $user = $this->member($organization, '1.00');

        $this->bookOn($user, $this->room('900.00'), null, '2026-11-01')
            ->assertStatus(201)
            ->assertJsonPath('reservation.status', 'pending');
    }

    public function test_another_member_has_an_independent_allowance()
    {
        $organization = $this->org();
        $first = $this->member($organization, '1000.00');
        $second = $this->member($organization, '1000.00');

        $this->book($first, $this->room('900.00'), $organization)->assertStatus(201);
        $this->book($second, $this->room('900.00'), $organization)->assertStatus(201);
    }

    // -- ML-4: month attribution --

    public function test_a_booking_in_another_start_month_is_unaffected()
    {
        $organization = $this->org();
        $user = $this->member($organization, '1000.00');

        $this->book($user, $this->room('900.00'), $organization, 0)->assertStatus(201);
        $this->book($user, $this->room('500.00'), $organization, 1)->assertStatus(201);
    }

    public function test_the_full_total_of_a_multi_month_booking_counts_in_its_start_month()
    {
        $organization = $this->org();
        $blocked = $this->member($organization, '2000.00');
        $allowed = $this->member($organization, '3000.00');

        $this->assertLimitRejected($this->book($blocked, $this->room('1000.00'), $organization, 0, 3));
        $this->book($allowed, $this->room('1000.00'), $organization, 0, 3)->assertStatus(201);
    }

    // -- ML-9: rollback --

    public function test_a_rejection_leaves_no_trace_and_the_dates_stay_bookable()
    {
        $organization = $this->org('5000.00');
        $limited = $this->member($organization, '100.00');
        $other = $this->member($organization, null);
        $room = $this->room('300.00');
        $before = $this->counts();

        $this->assertLimitRejected($this->book($limited, $room, $organization));

        $this->assertSame($before, $this->counts());
        $this->assertSame('5000.00', $organization->fresh()->wallet_balance);
        Notification::assertNothingSent();
        $this->book($other, $room, $organization)->assertStatus(201);
    }

    public function test_raising_the_limit_makes_the_identical_request_succeed()
    {
        $organization = $this->org();
        $user = $this->member($organization, '100.00');
        $room = $this->room('300.00');

        $this->assertLimitRejected($this->book($user, $room, $organization));
        $this->setLimit($organization, $user, '300.00');

        $this->book($user, $room, $organization)->assertStatus(201);
    }

    // -- ML-10: precedence --

    public function test_the_limit_error_wins_over_an_insufficient_balance()
    {
        $organization = $this->org('50.00');
        $user = $this->member($organization, '100.00');

        $response = $this->book($user, $this->room('200.00'), $organization);

        $this->assertLimitRejected($response);
        $this->assertArrayNotHasKey('wallet', $response->json('errors'));
    }

    public function test_a_balance_only_failure_keeps_the_wallet_error()
    {
        $organization = $this->org('50.00');
        $user = $this->member($organization, '1000.00');

        $this->book($user, $this->room('80.00'), $organization)
            ->assertStatus(422)
            ->assertJsonPath('errors.wallet.0', self::INSUFFICIENT)
            ->assertJsonMissingPath('errors.monthly_limit');
    }

    public function test_an_inactive_organization_and_a_date_conflict_win_over_the_limit_error()
    {
        $inactive = Organization::factory()->inactive()->withBalance('5000.00')->create();
        $overLimit = $this->member($inactive, '1.00');
        $this->book($overLimit, $this->room('300.00'), $inactive)
            ->assertStatus(422)
            ->assertJsonPath('errors.organization.0', 'La organización seleccionada no está activa.');

        $organization = $this->org();
        $first = $this->member($organization, null);
        $second = $this->member($organization, '1.00');
        $room = $this->room('300.00');
        $this->book($first, $room, $organization)->assertStatus(201);
        $this->book($second, $room, $organization)->assertStatus(409);
    }

    // -- ML-11: sequential double spend --

    public function test_the_second_of_two_sequential_bookings_cannot_exceed_the_limit()
    {
        $organization = $this->org();
        $user = $this->member($organization, '3000.00');

        $this->book($user, $this->room('1000.00'), $organization, 0, 3)->assertStatus(201);
        $this->assertLimitRejected($this->book($user, $this->room('1000.00'), $organization, 0, 3));

        $this->assertSame(1, OrganizationWalletMovement::where('type', WalletMovementType::Reserva->value)->count());
        $this->assertSame(1, Reservations::count());
        // No hold is left behind: another start month still books.
        $this->book($user, $this->room('1000.00'), $organization, 6, 3)->assertStatus(201);
    }

    // -- ML-6: refunds and penalties --

    /** Books $price from 2026-10-13 (3 days ahead) so `moderada` refunds half and `estricta` nothing. */
    private function bookSoon(User $user, Organization $organization, string $price, string $tier): string
    {
        $response = $this->bookOn($user, $this->room($price, $tier), $organization, '2026-10-13')->assertStatus(201);

        return (string) $response->json('reservation.id');
    }

    private function bookLaterInOctober(User $user, Organization $organization, string $price)
    {
        return $this->bookOn($user, $this->room($price), $organization, '2026-10-25');
    }

    public function test_a_full_refund_frees_the_whole_amount()
    {
        $organization = $this->org();
        $user = $this->member($organization, '1000.00');
        $id = $this->bookSoon($user, $organization, '800.00', 'flexible');
        $this->assertLimitRejected($this->bookLaterInOctober($user, $organization, '300.00'));

        $this->adminCancel($organization, $id)->assertOk();

        $this->bookLaterInOctober($user, $organization, '1000.00')->assertStatus(201);
    }

    public function test_a_partial_refund_frees_only_the_refunded_half()
    {
        $organization = $this->org();
        $user = $this->member($organization, '1000.00');
        $id = $this->bookSoon($user, $organization, '800.00', 'moderada');

        $this->adminCancel($organization, $id)->assertOk();

        $this->assertLimitRejected($this->bookLaterInOctober($user, $organization, '600.01'));
        $this->bookLaterInOctober($user, $organization, '600.00')->assertStatus(201);
    }

    public function test_a_zero_refund_keeps_the_whole_amount_counted()
    {
        $organization = $this->org();
        $user = $this->member($organization, '1000.00');
        $id = $this->bookSoon($user, $organization, '800.00', 'estricta');

        $this->adminCancel($organization, $id)->assertOk();

        $this->assertLimitRejected($this->bookLaterInOctober($user, $organization, '300.00'));
    }

    public function test_an_admin_cancel_frees_the_creators_allowance_and_leaves_the_admins_spend_alone()
    {
        $organization = $this->org();
        $creator = $this->member($organization, '1000.00');
        $admin = $this->member($organization, '1000.00', OrganizationRole::ADMIN);
        $creatorId = $this->bookSoon($creator, $organization, '800.00', 'moderada');
        $this->bookSoon($admin, $organization, '800.00', 'estricta');

        $this->tenantCancel($admin, $creatorId)->assertOk();

        $this->bookLaterInOctober($creator, $organization, '600.00')->assertStatus(201);
        $this->assertLimitRejected($this->bookLaterInOctober($admin, $organization, '300.00'));
    }

    public function test_a_gestor_cancel_frees_the_whole_amount_of_the_creator_only()
    {
        $organization = $this->org();
        $creator = $this->member($organization, '1000.00');
        $bystander = $this->member($organization, '1000.00');
        $gestor = User::factory()->create(['role' => 'landlord']);
        $landlord = Landlords::factory()->create(['user_id' => $gestor->id]);
        $room = $this->room('800.00', 'estricta', $landlord);
        $id = (string) $this->bookOn($creator, $room, $organization, '2026-10-13')->assertStatus(201)->json('reservation.id');
        $this->bookSoon($bystander, $organization, '800.00', 'estricta');

        $this->actingAs($gestor, 'sanctum')
            ->patchJson("/api/landlord/reservations/{$id}/cancel", ['reason' => 'El almacen sufrio un incendio'])
            ->assertOk();

        $this->bookLaterInOctober($creator, $organization, '1000.00')->assertStatus(201);
        $this->assertLimitRejected($this->bookLaterInOctober($bystander, $organization, '300.00'));
    }

    public function test_cancelling_a_next_month_reservation_frees_that_month_only()
    {
        $organization = $this->org();
        $user = $this->member($organization, '1000.00');
        $this->bookLaterInOctober($user, $organization, '500.00')->assertStatus(201);
        $novemberId = (string) $this->bookOn($user, $this->room('500.00'), $organization, '2026-11-05')->assertStatus(201)->json('reservation.id');

        $this->adminCancel($organization, $novemberId)->assertOk();

        $this->assertLimitRejected($this->bookLaterInOctober($user, $organization, '600.00'));
        $this->bookOn($user, $this->room('1000.00'), $organization, '2026-11-10')->assertStatus(201);
    }

    // -- ML-12: lowering a limit --

    public function test_lowering_a_limit_below_the_spend_is_not_retroactive()
    {
        $organization = $this->org();
        $user = $this->member($organization, '1000.00');
        $id = $this->bookSoon($user, $organization, '800.00', 'moderada');

        $this->setLimit($organization, $user, '500.00');

        $this->assertSame('confirmed', Reservations::findOrFail($id)->status);
        $this->assertLimitRejected($this->bookLaterInOctober($user, $organization, '100.00'));
        $this->bookOn($user, $this->room('100.00'), $organization, '2026-11-05')->assertStatus(201);

        // A refund brings the month back under the limit: 800 - 400 = 400, so 100 fits exactly.
        $this->adminCancel($organization, $id)->assertOk();
        $this->bookLaterInOctober($user, $organization, '100.00')->assertStatus(201);
    }
}
