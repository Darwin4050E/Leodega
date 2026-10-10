<?php

namespace Tests\Feature;

use App\Models\Organization;
use App\Models\OrganizationWalletMovement;
use App\Models\Reservations;
use App\Models\Tenants;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * org-wallet U1c: the public POST /payments never pays an organization
 * reservation (OW-13, OW-14, OR-13). Organization rows are paid only from the
 * wallet, at creation.
 */
class OrganizationPaymentGuardTest extends TestCase
{
    use RefreshDatabase;

    private const ORG_PAYS_FROM_WALLET = 'Las reservas de organización se pagan con el saldo de la organización';

    /** @return array{0: Reservations, 1: User, 2: Organization} */
    private function legacyPendingOrgReservation(array $attributes = []): array
    {
        $user = User::factory()->create(['role' => 'tenant']);
        $tenant = Tenants::factory()->create(['user_id' => $user->id]);
        $organization = Organization::factory()->withBalance('5000.00')->withMember($user)->create();
        $reservation = Reservations::factory()->forOrganization($organization)->create(array_merge([
            'tenant_id' => $tenant->id,
            'status' => 'pending',
        ], $attributes));

        return [$reservation, $user, $organization];
    }

    private function pay(User $user, Reservations $reservation, string $method = 'credit card'): \Illuminate\Testing\TestResponse
    {
        return $this->actingAs($user, 'sanctum')->postJson('/api/payments', [
            'reservation_id' => $reservation->id,
            'payment_method' => $method,
            'payment_state' => 'paid',
        ]);
    }

    public function test_card_payment_of_a_legacy_pending_org_reservation_is_rejected_and_nothing_changes()
    {
        [$reservation, $creator, $organization] = $this->legacyPendingOrgReservation();

        $this->pay($creator, $reservation)
            ->assertStatus(422)
            ->assertJsonPath('errors.payment_method.0', self::ORG_PAYS_FROM_WALLET);

        $this->assertDatabaseCount('payments', 0);
        $this->assertSame('pending', $reservation->fresh()->status);
        $this->assertSame('5000.00', $organization->fresh()->wallet_balance);
        $this->assertSame(0, OrganizationWalletMovement::count());
    }

    public function test_a_pending_card_payment_is_rejected_too()
    {
        [$reservation, $creator] = $this->legacyPendingOrgReservation();

        $this->actingAs($creator, 'sanctum')->postJson('/api/payments', [
            'reservation_id' => $reservation->id,
            'payment_method' => 'debit card',
            'payment_state' => 'pending',
        ])->assertStatus(422)->assertJsonPath('errors.payment_method.0', self::ORG_PAYS_FROM_WALLET);

        $this->assertDatabaseCount('payments', 0);
    }

    public function test_the_public_endpoint_rejects_the_wallet_method_for_a_personal_reservation()
    {
        $user = User::factory()->create(['role' => 'tenant']);
        $tenant = Tenants::factory()->create(['user_id' => $user->id]);
        $reservation = Reservations::factory()->create(['tenant_id' => $tenant->id, 'status' => 'pending']);

        $this->pay($user, $reservation, 'wallet')->assertStatus(422);

        $this->assertDatabaseCount('payments', 0);
        $this->assertSame('pending', $reservation->fresh()->status);
    }

    public function test_the_public_endpoint_rejects_the_wallet_method_for_an_org_reservation()
    {
        [$reservation, $creator, $organization] = $this->legacyPendingOrgReservation();

        $this->pay($creator, $reservation, 'wallet')->assertStatus(422);

        $this->assertDatabaseCount('payments', 0);
        $this->assertSame('5000.00', $organization->fresh()->wallet_balance);
        $this->assertSame(0, OrganizationWalletMovement::count());
    }

    public function test_an_org_admin_who_is_not_the_creator_cannot_pay_another_members_reservation()
    {
        [$reservation, , $organization] = $this->legacyPendingOrgReservation();
        $admin = User::factory()->create(['role' => 'tenant']);
        Tenants::factory()->create(['user_id' => $admin->id]);
        $organization->users()->attach($admin->id, ['role' => 'admin']);

        $this->pay($admin, $reservation)->assertStatus(403);

        $this->assertDatabaseCount('payments', 0);
        $this->assertSame('5000.00', $organization->fresh()->wallet_balance);
    }

    public function test_a_personal_card_payment_by_the_owner_still_succeeds()
    {
        $user = User::factory()->create(['role' => 'tenant']);
        $tenant = Tenants::factory()->create(['user_id' => $user->id]);
        $reservation = Reservations::factory()->create(['tenant_id' => $tenant->id, 'status' => 'pending']);

        $this->pay($user, $reservation)->assertStatus(201);

        $this->assertSame('confirmed', $reservation->fresh()->status);
        $this->assertDatabaseHas('payments', ['reservation_id' => $reservation->id, 'payment_method' => 'credit card']);
    }

    public function test_re_posting_a_payment_for_a_confirmed_org_reservation_is_rejected_too()
    {
        [$reservation, $creator, $organization] = $this->legacyPendingOrgReservation(['status' => 'confirmed']);

        $this->pay($creator, $reservation)
            ->assertStatus(422)
            ->assertJsonPath('errors.payment_method.0', self::ORG_PAYS_FROM_WALLET);

        $this->assertDatabaseCount('payments', 0);
        $this->assertSame('5000.00', $organization->fresh()->wallet_balance);
        $this->assertSame(0, OrganizationWalletMovement::count());
    }

    public function test_a_personal_confirmed_reservation_keeps_the_idempotent_no_op()
    {
        $user = User::factory()->create(['role' => 'tenant']);
        $tenant = Tenants::factory()->create(['user_id' => $user->id]);
        $reservation = Reservations::factory()->create(['tenant_id' => $tenant->id, 'status' => 'pending']);
        $this->pay($user, $reservation)->assertStatus(201);

        $this->pay($user, $reservation)->assertStatus(200);

        $this->assertDatabaseCount('payments', 1);
    }

    public function test_a_legacy_org_hold_past_its_expiry_is_released_with_no_wallet_movement()
    {
        [$reservation, $creator, $organization] = $this->legacyPendingOrgReservation([
            'created_at' => now()->subHours(2),
        ]);

        $this->pay($creator, $reservation)->assertStatus(409);

        $this->assertSame('canceled', $reservation->fresh()->status);
        $this->assertSame('Expired: payment hold elapsed', $reservation->fresh()->cancelation_reason);
        $this->assertSame('5000.00', $organization->fresh()->wallet_balance);
        $this->assertSame(0, OrganizationWalletMovement::count());
    }
}
