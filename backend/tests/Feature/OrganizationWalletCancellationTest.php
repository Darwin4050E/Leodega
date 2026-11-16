<?php

namespace Tests\Feature;

use App\Enums\OrganizationRole;
use App\Enums\WalletMovementType;
use App\Exceptions\ReservationConflictException;
use App\Models\Landlords;
use App\Models\Organization;
use App\Models\OrganizationWalletMovement;
use App\Models\Payments;
use App\Models\Reservations;
use App\Models\StoreRooms;
use App\Models\Tenants;
use App\Models\User;
use App\Services\ReservationService;
use App\Services\WalletService;
use App\Support\Money;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Notification;
use Tests\TestCase;

/**
 * org-wallet U1d: cancelling a wallet-paid organization reservation credits
 * the organization wallet (OW-7..OW-10, OW-15, OR-13). The tenant side gets the
 * tiered refund, the gestor side the full amount; the actor is always the
 * reservation creator. Every row is built with a real wallet debit so the
 * ledger stays consistent.
 */
class OrganizationWalletCancellationTest extends TestCase
{
    use RefreshDatabase;

    private User $creator;

    private User $admin;

    private Organization $organization;

    private User $gestor;

    protected function setUp(): void
    {
        parent::setUp();

        Notification::fake();

        $this->creator = User::factory()->create(['role' => 'tenant']);
        Tenants::factory()->create(['user_id' => $this->creator->id]);
        $this->admin = User::factory()->create(['role' => 'tenant']);
        Tenants::factory()->create(['user_id' => $this->admin->id]);
        $this->organization = Organization::factory()
            ->withBalance('1000.00')
            ->withMember($this->creator, OrganizationRole::MEMBER)
            ->withMember($this->admin, OrganizationRole::ADMIN)
            ->create();
        $this->gestor = User::factory()->create(['role' => 'landlord']);
        Landlords::factory()->create(['user_id' => $this->gestor->id]);
    }

    /**
     * A confirmed org reservation paid from the wallet: real debit, wallet
     * payment row. Starts in 3 days so `moderada` refunds 50% and `estricta`
     * refunds nothing.
     */
    private function paidReservation(string $total = '100.00', string $tier = 'moderada', array $overrides = []): Reservations
    {
        $room = StoreRooms::factory()->approved()->create([
            'landlord_id' => $this->gestor->landlord->id,
        ]);

        $reservation = Reservations::factory()->forOrganization($this->organization)->create(array_merge([
            'store_room_id' => $room->id,
            'tenant_id' => $this->creator->tenant->id,
            'status' => 'confirmed',
            'start_date' => now()->addDays(3)->toDateString(),
            'end_date' => now()->addDays(33)->toDateString(),
            'total_mount' => $total,
            'rent_subtotal' => Money::fromCents(intdiv(Money::toCents($total) * 8, 10)),
            'cancellation_policy_tier' => $tier,
        ], $overrides));

        DB::transaction(function () use ($reservation, $total) {
            $locked = app(WalletService::class)->lockOrganization($this->organization->id);
            app(WalletService::class)->debitForReservation($locked, $reservation, $total, $this->creator->id);
        });

        Payments::factory()->create([
            'reservation_id' => $reservation->id,
            'payment_method' => 'wallet',
            'payment_state' => 'paid',
        ]);

        return $reservation;
    }

    private function tenantCancel(Reservations $reservation, ?User $as = null)
    {
        return $this->actingAs($as ?? $this->admin, 'sanctum')
            ->patchJson("/api/tenant/reservations/{$reservation->id}/cancel", ['reason' => 'Ya no la necesito']);
    }

    private function movementsFor(User $user): array
    {
        return $this->actingAs($user, 'sanctum')
            ->getJson("/api/organizations/{$this->organization->id}/wallet/movements")
            ->assertOk()
            ->json();
    }

    private function gestorCancel(Reservations $reservation)
    {
        return $this->actingAs($this->gestor, 'sanctum')
            ->patchJson("/api/landlord/reservations/{$reservation->id}/cancel", ['reason' => 'El almacen sufrio un incendio']);
    }

    private function refunds(): \Illuminate\Database\Eloquent\Collection
    {
        return OrganizationWalletMovement::where('type', WalletMovementType::Reembolso->value)->get();
    }

    private function balance(): string
    {
        return $this->organization->fresh()->wallet_balance;
    }

    public function test_an_admin_cancel_credits_the_tiered_refund_to_the_wallet()
    {
        $reservation = $this->paidReservation('100.00', 'moderada');
        $this->assertSame('900.00', $this->balance());

        $this->tenantCancel($reservation)->assertOk();

        $refund = $this->refunds()->sole();
        $this->assertSame('50.00', $refund->amount);
        $this->assertSame('950.00', $refund->balance_after);
        $this->assertSame($this->creator->id, $refund->user_id);
        $this->assertSame($reservation->id, $refund->reservation_id);
        $this->assertSame('950.00', $this->balance());
        $this->assertDatabaseHas('reservations', ['id' => $reservation->id, 'status' => 'canceled', 'refund_amount' => '50.00']);
        $this->assertSame('50.00', Money::fromCents(Money::toCents('100.00') - Money::toCents($refund->amount)));
    }

    public function test_the_creator_member_cannot_cancel_and_nothing_is_credited()
    {
        $reservation = $this->paidReservation('100.00', 'moderada');

        $this->tenantCancel($reservation, $this->creator)->assertStatus(403);

        $this->assertSame('confirmed', $reservation->fresh()->status);
        $this->assertCount(0, $this->refunds());
        $this->assertSame('900.00', $this->balance());
    }

    public function test_a_full_tier_refund_returns_the_whole_amount()
    {
        $reservation = $this->paidReservation('100.00', 'flexible');

        $this->tenantCancel($reservation)->assertOk();

        $this->assertSame('100.00', $this->refunds()->sole()->amount);
        $this->assertSame('1000.00', $this->balance());
    }

    public function test_a_zero_refund_tier_writes_no_movement_and_keeps_the_balance()
    {
        $reservation = $this->paidReservation('100.00', 'estricta');

        $this->tenantCancel($reservation)->assertOk();

        $this->assertCount(0, $this->refunds());
        $this->assertSame('900.00', $this->balance());
        $this->assertDatabaseHas('reservations', [
            'id' => $reservation->id,
            'status' => 'canceled',
            'cancelation_reason' => 'Ya no la necesito',
            'refund_amount' => '0.00',
        ]);
    }

    public function test_the_preview_amount_equals_the_credited_amount()
    {
        $reservation = $this->paidReservation('100.00', 'moderada');

        $preview = $this->actingAs($this->admin, 'sanctum')
            ->getJson("/api/tenant/reservations/{$reservation->id}/cancellation-preview")
            ->assertOk()
            ->json('refund_amount');
        $this->tenantCancel($reservation)->assertOk();

        $this->assertSame($preview, $this->refunds()->sole()->amount);
    }

    public function test_an_odd_cent_total_splits_into_a_rounded_refund_and_an_exact_penalty()
    {
        $reservation = $this->paidReservation('10.01', 'moderada');

        $this->tenantCancel($reservation)->assertOk();

        $credited = $this->refunds()->sole()->amount;
        $this->assertSame('5.01', $credited);
        $this->assertSame('5.00', Money::fromCents(Money::toCents('10.01') - Money::toCents($credited)));
        $this->assertSame('995.00', $this->balance());
    }

    public function test_a_personal_cancel_writes_no_wallet_movement()
    {
        $room = StoreRooms::factory()->approved()->create();
        $personal = Reservations::factory()->create([
            'store_room_id' => $room->id,
            'tenant_id' => $this->creator->tenant->id,
            'status' => 'confirmed',
            'start_date' => now()->addDays(3)->toDateString(),
            'end_date' => now()->addDays(33)->toDateString(),
            'cancellation_policy_tier' => 'flexible',
        ]);
        Payments::factory()->create([
            'reservation_id' => $personal->id,
            'payment_method' => 'credit card',
            'payment_state' => 'paid',
        ]);

        $this->tenantCancel($personal, $this->creator)->assertOk();

        $this->assertSame(0, OrganizationWalletMovement::count());
        $this->assertSame('1000.00', $this->balance());
    }

    public function test_an_inactive_org_is_still_credited()
    {
        $reservation = $this->paidReservation('100.00', 'flexible');
        $this->organization->update(['status' => 'inactive']);

        $this->tenantCancel($reservation)->assertOk();

        $this->assertSame('100.00', $this->refunds()->sole()->amount);
        $this->assertSame('1000.00', $this->balance());
    }

    public function test_a_legacy_card_paid_org_reservation_gets_no_wallet_credit()
    {
        $reservation = $this->paidReservation('100.00', 'flexible');
        Payments::where('reservation_id', $reservation->id)->update(['payment_method' => 'credit card']);

        $this->tenantCancel($reservation)->assertOk();

        $this->assertCount(0, $this->refunds());
        $this->assertSame('900.00', $this->balance());
        $this->assertDatabaseHas('reservations', ['id' => $reservation->id, 'refund_amount' => '100.00']);
    }

    public function test_a_legacy_pending_org_reservation_cancel_credits_nothing()
    {
        $reservation = $this->paidReservation('100.00', 'flexible', ['status' => 'pending']);
        Payments::where('reservation_id', $reservation->id)->delete();

        $this->tenantCancel($reservation)->assertOk();

        $this->assertCount(0, $this->refunds());
    }

    public function test_a_second_cancel_is_rejected_and_credits_nothing_more()
    {
        $reservation = $this->paidReservation('100.00', 'moderada');
        $this->tenantCancel($reservation)->assertOk();

        $this->tenantCancel($reservation)->assertStatus(409);

        $this->assertCount(1, $this->refunds());
        $this->assertSame('950.00', $this->balance());
    }

    public function test_another_org_admin_can_cancel_the_creators_reservation()
    {
        $reservation = $this->paidReservation('100.00', 'moderada');
        $admin = User::factory()->create(['role' => 'tenant']);
        Tenants::factory()->create(['user_id' => $admin->id]);
        $this->organization->users()->attach($admin->id, ['role' => OrganizationRole::ADMIN->value]);

        $this->tenantCancel($reservation, $admin)->assertOk();

        $this->assertSame('canceled', $reservation->fresh()->status);
        $refund = $this->refunds()->sole();
        $this->assertSame($this->creator->id, $refund->user_id);
        $this->assertSame('50.00', $refund->amount);
        $this->assertSame('950.00', $this->balance());
    }

    public function test_the_admin_own_movements_are_unchanged_and_the_creator_sees_the_refund_alone()
    {
        $reservation = $this->paidReservation('100.00', 'moderada');
        $peer = User::factory()->create(['role' => 'tenant']);
        Tenants::factory()->create(['user_id' => $peer->id]);
        $this->organization->users()->attach($peer->id, ['role' => OrganizationRole::MEMBER->value]);

        $this->tenantCancel($reservation)->assertOk();

        $this->assertSame(0, OrganizationWalletMovement::where('user_id', $this->admin->id)->count());
        $forCreator = $this->movementsFor($this->creator);
        $this->assertContains('reembolso', array_column($forCreator, 'type'));
        $this->assertSame([], array_column($this->movementsFor($peer), 'type'));
    }

    public function test_an_admin_cancelling_own_reservation_is_the_refund_actor()
    {
        $adminTenantId = $this->admin->tenant->id;
        $reservation = $this->paidReservation('100.00', 'moderada', ['tenant_id' => $adminTenantId]);

        $this->tenantCancel($reservation)->assertOk();

        $this->assertSame($this->admin->id, $this->refunds()->sole()->user_id);
    }

    public function test_the_refund_is_credited_to_the_org_even_when_the_creator_left()
    {
        $reservation = $this->paidReservation('100.00', 'moderada');
        $this->organization->users()->detach($this->creator->id);

        $this->tenantCancel($reservation)->assertOk();

        $refund = $this->refunds()->sole();
        $this->assertSame($this->creator->id, $refund->user_id);
        $this->assertSame('50.00', $refund->amount);
        $this->assertSame('950.00', $this->balance());
    }

    public function test_the_gestor_cancel_credits_the_full_amount_attributed_to_the_creator()
    {
        $reservation = $this->paidReservation('100.00', 'estricta');

        $this->gestorCancel($reservation)->assertOk();

        $refund = $this->refunds()->sole();
        $this->assertSame('100.00', $refund->amount);
        $this->assertSame($this->creator->id, $refund->user_id);
        $this->assertSame($reservation->id, $refund->reservation_id);
        $this->assertSame('1000.00', $this->balance());
        $this->assertDatabaseHas('reservation_cancellation_obligations', [
            'reservation_id' => $reservation->id,
            'refund_amount' => '100.00',
        ]);
    }

    public function test_a_gestor_cancel_of_a_removed_members_reservation_still_credits_the_org()
    {
        $reservation = $this->paidReservation('100.00');
        $this->organization->users()->detach($this->creator->id);

        $this->gestorCancel($reservation)->assertOk();

        $refund = $this->refunds()->sole();
        $this->assertSame('100.00', $refund->amount);
        $this->assertSame($this->creator->id, $refund->user_id);
        $this->assertSame('1000.00', $this->balance());
    }

    public function test_a_gestor_cancel_of_a_legacy_pending_org_reservation_is_rejected_without_credit()
    {
        $reservation = $this->paidReservation('100.00', 'moderada', ['status' => 'pending']);

        $this->gestorCancel($reservation)->assertStatus(409);

        $this->assertCount(0, $this->refunds());
        $this->assertSame('900.00', $this->balance());
    }

    public function test_a_gestor_cancel_of_a_legacy_card_paid_org_reservation_credits_nothing()
    {
        $reservation = $this->paidReservation('100.00');
        Payments::where('reservation_id', $reservation->id)->update(['payment_method' => 'debit card']);

        $this->gestorCancel($reservation)->assertOk();

        $this->assertCount(0, $this->refunds());
        $this->assertSame('900.00', $this->balance());
    }

    public function test_a_second_gestor_cancel_is_rejected_and_credits_nothing_more()
    {
        $reservation = $this->paidReservation('100.00');
        $this->gestorCancel($reservation)->assertOk();

        $this->gestorCancel($reservation)->assertStatus(409);

        $this->assertCount(1, $this->refunds());
        $this->assertSame('1000.00', $this->balance());
    }

    public function test_a_stale_in_memory_reservation_cannot_trigger_a_second_gestor_credit()
    {
        $reservation = $this->paidReservation('100.00');
        $stale = Reservations::find($reservation->id);
        $this->gestorCancel($reservation)->assertOk();

        try {
            app(ReservationService::class)->cancelByLandlord($stale, 'El almacen sufrio un incendio', $this->gestor->id);
            $this->fail('A canceled reservation must not be cancelled again.');
        } catch (ReservationConflictException) {
            // expected
        }

        $this->assertCount(1, $this->refunds());
        $this->assertSame('1000.00', $this->balance());
        $this->assertDatabaseCount('reservation_cancellation_obligations', 1);
    }

    public function test_a_gestor_cancel_of_a_personal_reservation_has_no_wallet_effect()
    {
        $room = StoreRooms::factory()->approved()->create(['landlord_id' => $this->gestor->landlord->id]);
        $personal = Reservations::factory()->create([
            'store_room_id' => $room->id,
            'tenant_id' => $this->creator->tenant->id,
            'status' => 'confirmed',
            'start_date' => now()->addDays(5)->toDateString(),
            'end_date' => now()->addDays(35)->toDateString(),
        ]);
        Payments::factory()->create([
            'reservation_id' => $personal->id,
            'payment_method' => 'credit card',
            'payment_state' => 'paid',
        ]);

        $this->gestorCancel($personal)->assertOk();

        $this->assertSame(0, OrganizationWalletMovement::count());
        $this->assertSame('1000.00', $this->balance());
    }
}
