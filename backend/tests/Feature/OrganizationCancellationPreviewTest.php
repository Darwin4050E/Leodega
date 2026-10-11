<?php

namespace Tests\Feature;

use App\Enums\OrganizationRole;
use App\Models\Organization;
use App\Models\Reservations;
use App\Models\StoreRooms;
use App\Models\Tenants;
use App\Models\User;
use App\Support\Money;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Testing\TestResponse;
use Tests\TestCase;

/**
 * HUE-06 OW-8: the cancellation preview exposes total, refund and penalty
 * (derived, never stored) and they always add up to the total in cents.
 */
class OrganizationCancellationPreviewTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;

    private User $creator;

    private Organization $organization;

    protected function setUp(): void
    {
        parent::setUp();

        $this->creator = $this->tenantUser();
        $this->admin = $this->tenantUser();
        $this->organization = Organization::factory()
            ->withBalance('1000.00')
            ->withMember($this->creator, OrganizationRole::MEMBER)
            ->withMember($this->admin, OrganizationRole::ADMIN)
            ->create();
    }

    private function tenantUser(): User
    {
        $user = User::factory()->create(['role' => 'tenant']);
        Tenants::factory()->create(['user_id' => $user->id]);

        return $user;
    }

    private function reservation(string $total, string $tier, int $daysAhead = 3, string $status = 'confirmed', bool $organization = true): Reservations
    {
        $factory = Reservations::factory();
        if ($organization) {
            $factory = $factory->forOrganization($this->organization);
        }

        return $factory->create([
            'store_room_id' => StoreRooms::factory()->approved()->create()->id,
            'tenant_id' => $this->creator->tenant->id,
            'status' => $status,
            'start_date' => now()->addDays($daysAhead)->toDateString(),
            'end_date' => now()->addDays($daysAhead + 30)->toDateString(),
            'total_mount' => $total,
            'cancellation_policy_tier' => $tier,
        ]);
    }

    private function preview(Reservations $reservation, ?User $as = null): TestResponse
    {
        return $this->actingAs($as ?? $this->admin, 'sanctum')
            ->getJson("/api/tenant/reservations/{$reservation->id}/cancellation-preview");
    }

    public function test_a_full_refund_tier_has_no_penalty()
    {
        $response = $this->preview($this->reservation('100.00', 'flexible', 10));

        $response->assertOk();
        $this->assertSame(
            ['can_be_cancelled' => true, 'total_amount' => '100.00', 'refund_amount' => '100.00', 'penalty_amount' => '0.00'],
            $response->json(),
        );
    }

    public function test_a_half_refund_tier_splits_the_total_in_two()
    {
        $response = $this->preview($this->reservation('100.00', 'moderada', 3));

        $this->assertSame('100.00', $response->json('total_amount'));
        $this->assertSame('50.00', $response->json('refund_amount'));
        $this->assertSame('50.00', $response->json('penalty_amount'));
    }

    public function test_a_zero_refund_tier_penalizes_the_whole_total()
    {
        $response = $this->preview($this->reservation('100.00', 'estricta', 3));

        $this->assertSame('0.00', $response->json('refund_amount'));
        $this->assertSame('100.00', $response->json('penalty_amount'));
    }

    public function test_an_odd_cent_total_keeps_refund_plus_penalty_equal_to_the_total_in_cents()
    {
        $response = $this->preview($this->reservation('10.01', 'moderada', 3));

        $this->assertSame('5.01', $response->json('refund_amount'));
        $this->assertSame('5.00', $response->json('penalty_amount'));
        $this->assertSame(
            Money::toCents($response->json('total_amount')),
            Money::toCents($response->json('refund_amount')) + Money::toCents($response->json('penalty_amount')),
        );
    }

    public function test_a_legacy_pending_reservation_previews_zero_everywhere()
    {
        $response = $this->preview($this->reservation('100.00', 'flexible', 10, 'pending'));

        $response->assertOk();
        $this->assertSame('0.00', $response->json('total_amount'));
        $this->assertSame('0.00', $response->json('refund_amount'));
        $this->assertSame('0.00', $response->json('penalty_amount'));
    }

    public function test_the_previewed_amounts_equal_what_the_cancel_records()
    {
        $reservation = $this->reservation('10.01', 'moderada', 3);
        $preview = $this->preview($reservation);

        $this->actingAs($this->admin, 'sanctum')
            ->patchJson("/api/tenant/reservations/{$reservation->id}/cancel", ['reason' => 'Cambio de planes de la empresa'])
            ->assertOk();

        $stored = $reservation->fresh();
        $refundCents = Money::toCents((string) $stored->refund_amount);
        $this->assertSame(Money::toCents($preview->json('refund_amount')), $refundCents);
        $this->assertSame(
            $preview->json('penalty_amount'),
            Money::fromCents(Money::toCents((string) $stored->total_mount) - $refundCents),
        );
    }

    public function test_a_personal_preview_gains_the_new_fields_without_changing_the_old_ones()
    {
        $response = $this->preview($this->reservation('100.00', 'moderada', 3, 'confirmed', false), $this->creator);

        $response->assertOk();
        $this->assertSame(
            ['can_be_cancelled' => true, 'total_amount' => '100.00', 'refund_amount' => '50.00', 'penalty_amount' => '50.00'],
            $response->json(),
        );
    }
}
