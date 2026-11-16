<?php

namespace Tests\Concerns;

use App\Enums\OrganizationRole;
use App\Models\Landlords;
use App\Models\Organization;
use App\Models\Payments;
use App\Models\Reservations;
use App\Models\StoreRooms;
use App\Models\Tenants;
use App\Models\User;
use App\Services\WalletService;
use App\Support\Money;
use Illuminate\Support\Facades\DB;
use Illuminate\Testing\TestResponse;

/**
 * HUE-06 U1b: one organization with a creator (member), an admin, another
 * member and a gestor, plus a wallet-paid reservation to cancel. Call
 * buildScenario() from setUp().
 */
trait BuildsOrganizationCancellationScenario
{
    protected User $creator;

    protected User $admin;

    protected User $otherMember;

    protected User $gestor;

    protected Organization $organization;

    protected function buildScenario(): void
    {
        $this->creator = $this->tenantUser();
        $this->admin = $this->tenantUser();
        $this->otherMember = $this->tenantUser();
        $this->organization = Organization::factory()
            ->withBalance('1000.00')
            ->withMember($this->creator, OrganizationRole::MEMBER)
            ->withMember($this->admin, OrganizationRole::ADMIN)
            ->withMember($this->otherMember, OrganizationRole::MEMBER)
            ->create(['name' => 'Andina', 'ruc' => '1790011111001']);
        $this->gestor = User::factory()->create(['role' => 'landlord']);
        Landlords::factory()->create(['user_id' => $this->gestor->id]);
    }

    protected function tenantUser(): User
    {
        $user = User::factory()->create(['role' => 'tenant']);
        Tenants::factory()->create(['user_id' => $user->id]);

        return $user;
    }

    /**
     * A confirmed org reservation by the creator, paid from the wallet with a
     * real debit. Starts in 3 days: `moderada` refunds 50%, `estricta` nothing.
     */
    protected function paidReservation(string $total = '100.00', string $tier = 'moderada', array $overrides = []): Reservations
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

    protected function cancel(Reservations $reservation, ?User $as = null, mixed $reason = 'Ya no la necesito'): TestResponse
    {
        return $this->actingAs($as ?? $this->admin, 'sanctum')
            ->patchJson("/api/tenant/reservations/{$reservation->id}/cancel", $reason === null ? [] : ['reason' => $reason]);
    }

    protected function preview(Reservations $reservation, ?User $as = null): TestResponse
    {
        return $this->actingAs($as ?? $this->admin, 'sanctum')
            ->getJson("/api/tenant/reservations/{$reservation->id}/cancellation-preview");
    }
}
