<?php

namespace Tests\Feature;

use App\Enums\OrganizationRole;
use App\Enums\WalletMovementType;
use App\Models\Organization;
use App\Models\OrganizationWalletMovement;
use App\Models\Payments;
use App\Models\Reservations;
use App\Models\StorePrices;
use App\Models\StoreRooms;
use App\Models\Tenants;
use App\Models\User;
use App\Notifications\ReservationReceiptNotification;
use App\Services\ReservationPricingService;
use App\Services\ReservationService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Notification;
use RuntimeException;
use Tests\TestCase;

/**
 * org-wallet U1c: an organization reservation is created, paid from the
 * wallet and confirmed in one transaction (OW-5, OW-6, OW-7, OR-1, OR-13).
 * Rooms are priced 1000/month and booked for 3 months, so every total is
 * 3000.00.
 */
class OrganizationWalletReservationTest extends TestCase
{
    use RefreshDatabase;

    private const INSUFFICIENT = 'Saldo insuficiente en la organización';

    private function member(Organization $organization, OrganizationRole $role = OrganizationRole::MEMBER): User
    {
        $user = User::factory()->create(['role' => 'tenant']);
        Tenants::factory()->create(['user_id' => $user->id]);
        $organization->users()->attach($user->id, ['role' => $role->value]);

        return $user;
    }

    private function funded(string $balance): Organization
    {
        return Organization::factory()->withBalance($balance)->create();
    }

    private function room(): StoreRooms
    {
        $room = StoreRooms::factory()->approved()->create();
        StorePrices::factory()->create([
            'store_room_id' => $room->id,
            'mode' => 'month',
            'price' => 1000,
            'disponibility' => true,
        ]);

        return $room;
    }

    private function book(User $user, StoreRooms $room, Organization $organization, int $monthsAhead = 1): \Illuminate\Testing\TestResponse
    {
        $start = today()->startOfMonth()->addMonths($monthsAhead);

        return $this->actingAs($user, 'sanctum')->postJson('/api/reservations', [
            'store_room_id' => $room->id,
            'start_date' => $start->toDateString(),
            'end_date' => $start->copy()->addMonths(3)->toDateString(),
        ], ['X-Organization-Id' => (string) $organization->id]);
    }

    private function assertNothingBooked(Organization $organization, string $balance): void
    {
        $this->assertDatabaseCount('reservations', 0);
        $this->assertDatabaseCount('payments', 0);
        $this->assertSame(0, OrganizationWalletMovement::where('organization_id', $organization->id)->count());
        $this->assertSame($balance, $organization->fresh()->wallet_balance);
    }

    // -- OW-5 / OR-1 / OR-2: atomic pay + confirm --

    public function test_a_member_reserves_and_the_reservation_is_confirmed_and_paid_from_the_wallet()
    {
        $organization = $this->funded('5000.00');
        $user = $this->member($organization, OrganizationRole::MEMBER);
        $room = $this->room();

        $response = $this->book($user, $room, $organization);

        $response->assertStatus(201);
        $response->assertJsonPath('message', 'Reserva confirmada y pagada con el saldo de la organización');
        $response->assertJsonPath('reservation.status', 'confirmed');
        $response->assertJsonPath('reservation.organization.id', $organization->id);
        $response->assertJsonPath('reservation.organization.ruc', $organization->ruc);
        $response->assertJsonPath('reservation.is_creator', true);
        $response->assertJsonPath('reservation.payment_method', 'wallet');

        $reservation = Reservations::firstOrFail();
        $this->assertSame('confirmed', $reservation->status);
        $this->assertDatabaseHas('payments', [
            'reservation_id' => $reservation->id,
            'payment_method' => 'wallet',
            'payment_state' => 'paid',
        ]);
        $this->assertSame('2000.00', $organization->fresh()->wallet_balance);

        $movement = OrganizationWalletMovement::sole();
        $this->assertSame(WalletMovementType::Reserva, $movement->type);
        $this->assertSame('-3000.00', $movement->amount);
        $this->assertSame('2000.00', $movement->balance_after);
        $this->assertSame($user->id, $movement->user_id);
        $this->assertSame($reservation->id, $movement->reservation_id);
    }

    public function test_an_admin_gets_the_identical_outcome_as_a_member()
    {
        $organization = $this->funded('5000.00');
        $admin = $this->member($organization, OrganizationRole::ADMIN);

        $this->book($admin, $this->room(), $organization)->assertStatus(201);

        $this->assertSame('confirmed', Reservations::firstOrFail()->status);
        $this->assertSame('2000.00', $organization->fresh()->wallet_balance);
    }

    public function test_a_balance_equal_to_the_total_is_spent_down_to_zero()
    {
        $organization = $this->funded('3000.00');
        $user = $this->member($organization);

        $this->book($user, $this->room(), $organization)->assertStatus(201);

        $this->assertSame('0.00', $organization->fresh()->wallet_balance);
    }

    public function test_a_body_organization_id_never_selects_the_wallet_that_pays()
    {
        $header = $this->funded('5000.00');
        $other = $this->funded('5000.00');
        $user = $this->member($header);
        $other->users()->attach($user->id, ['role' => 'member']);
        $room = $this->room();
        $start = today()->startOfMonth()->addMonth();

        $this->actingAs($user, 'sanctum')->postJson('/api/reservations', [
            'store_room_id' => $room->id,
            'start_date' => $start->toDateString(),
            'end_date' => $start->copy()->addMonths(3)->toDateString(),
            'organization_id' => $other->id,
        ], ['X-Organization-Id' => (string) $header->id])->assertStatus(201);

        $this->assertSame('2000.00', $header->fresh()->wallet_balance);
        $this->assertSame('5000.00', $other->fresh()->wallet_balance);
    }

    public function test_a_personal_reservation_stays_pending_and_never_touches_a_wallet()
    {
        $organization = $this->funded('5000.00');
        $user = $this->member($organization);
        $room = $this->room();
        $start = today()->startOfMonth()->addMonth();

        $this->actingAs($user, 'sanctum')->postJson('/api/reservations', [
            'store_room_id' => $room->id,
            'start_date' => $start->toDateString(),
            'end_date' => $start->copy()->addMonths(3)->toDateString(),
        ])->assertStatus(201)
            ->assertJsonPath('message', 'Solicitud enviada')
            ->assertJsonPath('reservation.status', 'pending');

        $this->assertDatabaseCount('payments', 0);
        $this->assertSame(0, OrganizationWalletMovement::count());
        $this->assertSame('5000.00', $organization->fresh()->wallet_balance);
    }

    // -- OW-5: rejections happen before the debit --

    public function test_a_date_conflict_is_rejected_and_the_balance_is_untouched()
    {
        $organization = $this->funded('9000.00');
        $first = $this->member($organization);
        $second = $this->member($organization);
        $room = $this->room();

        $this->book($first, $room, $organization)->assertStatus(201);
        $this->book($second, $room, $organization)->assertStatus(409);

        $this->assertSame('6000.00', $organization->fresh()->wallet_balance);
        $this->assertSame(1, OrganizationWalletMovement::count());
        $this->assertSame(1, Reservations::count());
    }

    public function test_an_inactive_organization_is_rejected_before_any_debit()
    {
        $organization = Organization::factory()->inactive()->withBalance('5000.00')->create();
        $user = $this->member($organization);

        $this->book($user, $this->room(), $organization)
            ->assertStatus(422)
            ->assertJsonPath('errors.organization.0', 'La organización seleccionada no está activa.');

        $this->assertNothingBooked($organization, '5000.00');
    }

    public function test_an_organization_deactivated_after_it_was_loaded_is_rejected_before_the_debit()
    {
        $organization = $this->funded('5000.00');
        $user = $this->member($organization);
        $tenant = Tenants::where('user_id', $user->id)->firstOrFail();
        $stale = $organization->fresh();
        Organization::whereKey($organization->id)->update(['status' => 'inactive']);

        try {
            app(ReservationService::class)->create($tenant, $this->room(), [
                'start_date' => today()->startOfMonth()->addMonth()->toDateString(),
                'end_date' => today()->startOfMonth()->addMonths(4)->toDateString(),
            ], $user->id, $stale);
            $this->fail('Expected a ValidationException for the deactivated organization.');
        } catch (\Illuminate\Validation\ValidationException $exception) {
            $this->assertSame(
                ['La organización seleccionada no está activa.'],
                $exception->errors()['organization'],
            );
        }

        $this->assertNothingBooked($organization, '5000.00');
    }

    // -- OW-6: no overdraft --

    public function test_an_insufficient_balance_is_a_422_on_the_wallet_key_and_writes_nothing()
    {
        $organization = $this->funded('2999.99');
        $user = $this->member($organization);
        $room = $this->room();

        $this->book($user, $room, $organization)
            ->assertStatus(422)
            ->assertJsonPath('errors.wallet.0', self::INSUFFICIENT);

        $this->assertNothingBooked($organization, '2999.99');
        // No hold is left behind: the same dates can be booked once funded.
        Organization::whereKey($organization->id)->update(['wallet_balance' => '3000.00']);
        $this->book($user, $room, $organization)->assertStatus(201);
    }

    public function test_a_member_and_an_admin_get_the_same_insufficient_balance_message()
    {
        $organization = $this->funded('0.00');
        $member = $this->member($organization, OrganizationRole::MEMBER);
        $admin = $this->member($organization, OrganizationRole::ADMIN);
        $room = $this->room();

        foreach ([$member, $admin] as $user) {
            $this->book($user, $room, $organization)
                ->assertStatus(422)
                ->assertJsonPath('errors.wallet.0', self::INSUFFICIENT);
        }
    }

    public function test_the_second_of_two_sequential_reservations_cannot_overdraft()
    {
        $organization = $this->funded('4000.00');
        $user = $this->member($organization);

        $this->book($user, $this->room(), $organization, 1)->assertStatus(201);
        $this->assertSame('1000.00', $organization->fresh()->wallet_balance);

        $this->book($user, $this->room(), $organization, 6)
            ->assertStatus(422)
            ->assertJsonPath('errors.wallet.0', self::INSUFFICIENT);

        $this->assertSame('1000.00', $organization->fresh()->wallet_balance);
        $this->assertSame(1, OrganizationWalletMovement::count());
        $this->assertSame(1, Reservations::count());
    }

    // -- OW-S6: atomicity --

    public function test_a_failure_after_the_debit_rolls_back_the_reservation_the_payment_and_the_movement()
    {
        $organization = $this->funded('5000.00');
        $user = $this->member($organization);
        $tenant = Tenants::where('user_id', $user->id)->firstOrFail();
        Payments::creating(function () {
            throw new RuntimeException('payment insert failed');
        });

        try {
            app(ReservationService::class)->create($tenant, $this->room(), [
                'start_date' => today()->startOfMonth()->addMonth()->toDateString(),
                'end_date' => today()->startOfMonth()->addMonths(4)->toDateString(),
            ], $user->id, $organization);
            $this->fail('Expected the payment insert to fail.');
        } catch (RuntimeException $exception) {
            $this->assertSame('payment insert failed', $exception->getMessage());
        } finally {
            Payments::flushEventListeners();
        }

        $this->assertNothingBooked($organization, '5000.00');
        $this->assertDatabaseCount('notifications', 0);
    }

    // -- OW-S20: receipt notification after commit --

    public function test_the_receipt_email_is_sent_once_to_the_creator_after_a_successful_reservation()
    {
        Notification::fake();
        $organization = $this->funded('5000.00');
        $user = $this->member($organization);

        $this->book($user, $this->room(), $organization)->assertStatus(201);

        Notification::assertSentToTimes($user, ReservationReceiptNotification::class, 1);
    }

    public function test_no_receipt_email_is_sent_when_the_reservation_is_rejected()
    {
        Notification::fake();
        $organization = $this->funded('10.00');
        $user = $this->member($organization);

        $this->book($user, $this->room(), $organization)->assertStatus(422);

        Notification::assertNothingSent();
    }

    // -- a failing mailer never undoes a committed reservation --

    public function test_a_mail_failure_does_not_roll_back_the_committed_reservation()
    {
        $organization = $this->funded('5000.00');
        $user = $this->member($organization);
        Notification::shouldReceive('send')->andThrow(new RuntimeException('smtp down'));
        $tenant = Tenants::where('user_id', $user->id)->firstOrFail();
        $service = new ReservationService(new ReservationPricingService);

        $reservation = $service->create($tenant, $this->room(), [
            'start_date' => today()->startOfMonth()->addMonth()->toDateString(),
            'end_date' => today()->startOfMonth()->addMonths(4)->toDateString(),
        ], $user->id, $organization);

        $this->assertSame('confirmed', $reservation->fresh()->status);
        $this->assertSame('2000.00', $organization->fresh()->wallet_balance);
    }
}
