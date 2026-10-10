<?php

namespace Tests\Feature;

use App\Enums\OrganizationRole;
use App\Models\Landlords;
use App\Models\Organization;
use App\Models\Payments;
use App\Models\Reservations;
use App\Models\StoreRooms;
use App\Models\Tenants;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * sdd/huc05-payment-receipt: GET /api/tenant/reservations/{reservation}/receipt.
 * Order of checks: 401 -> 404 (binding) -> 403 (policy) -> 404 (not
 * receiptable) -> 200.
 */
class TenantReservationReceiptTest extends TestCase
{
    use RefreshDatabase;

    private function tenantUser(): array
    {
        $user = User::factory()->create(['role' => 'tenant']);
        $tenant = Tenants::factory()->create(['user_id' => $user->id]);

        return [$user, $tenant];
    }

    private function reservationFor(Tenants $tenant, array $overrides = [], array $roomOverrides = []): Reservations
    {
        $room = StoreRooms::factory()->approved()->create($roomOverrides);

        return Reservations::factory()->create(array_merge([
            'store_room_id' => $room->id,
            'tenant_id' => $tenant->id,
            'status' => 'confirmed',
            'start_date' => now()->addDays(10)->toDateString(),
            'end_date' => now()->addDays(20)->toDateString(),
            'total_mount' => 1850,
        ], $overrides));
    }

    private function pay(Reservations $reservation, string $state = 'paid'): Payments
    {
        return Payments::factory()->create([
            'reservation_id' => $reservation->id,
            'payment_state' => $state,
        ]);
    }

    private function receiptUrl(int $id): string
    {
        return "/api/tenant/reservations/{$id}/receipt";
    }

    public function test_owner_downloads_the_pdf_of_a_confirmed_paid_reservation()
    {
        [$user, $tenant] = $this->tenantUser();
        $reservation = $this->reservationFor($tenant, ['id' => 123]);
        $this->pay($reservation);

        $response = $this->actingAs($user, 'sanctum')->get($this->receiptUrl(123));

        $response->assertStatus(200);
        $response->assertHeader('Content-Type', 'application/pdf');
        $this->assertStringContainsString('attachment', $response->headers->get('Content-Disposition'));
        $this->assertStringContainsString('comprobante-LEO-000123.pdf', $response->headers->get('Content-Disposition'));
        $this->assertStringStartsWith('%PDF', $response->getContent());
    }

    private function paidReservationOfAnotherTenant(array $roomOverrides = []): Reservations
    {
        [, $tenant] = $this->tenantUser();
        $reservation = $this->reservationFor($tenant, [], $roomOverrides);
        $this->pay($reservation);

        return $reservation;
    }

    public function test_unauthenticated_request_is_rejected_with_401()
    {
        $reservation = $this->paidReservationOfAnotherTenant();

        $this->getJson($this->receiptUrl($reservation->id))->assertStatus(401);
    }

    public function test_another_tenant_is_forbidden_from_a_paid_receipt()
    {
        $reservation = $this->paidReservationOfAnotherTenant();
        [$intruder] = $this->tenantUser();

        $response = $this->actingAs($intruder, 'sanctum')->getJson($this->receiptUrl($reservation->id));

        $response->assertStatus(403);
        $this->assertNotSame('application/pdf', $response->headers->get('Content-Type'));
    }

    public function test_the_gestor_who_owns_the_room_is_forbidden()
    {
        $gestor = User::factory()->create(['role' => 'landlord']);
        $landlord = Landlords::factory()->create(['user_id' => $gestor->id]);
        $reservation = $this->paidReservationOfAnotherTenant(['landlord_id' => $landlord->id]);

        $this->actingAs($gestor, 'sanctum')->getJson($this->receiptUrl($reservation->id))->assertStatus(403);
    }

    public function test_any_other_landlord_is_forbidden()
    {
        $reservation = $this->paidReservationOfAnotherTenant();
        $landlordUser = User::factory()->create(['role' => 'landlord']);
        Landlords::factory()->create(['user_id' => $landlordUser->id]);

        $this->actingAs($landlordUser, 'sanctum')->getJson($this->receiptUrl($reservation->id))->assertStatus(403);
    }

    public function test_an_admin_is_forbidden()
    {
        $reservation = $this->paidReservationOfAnotherTenant();
        $admin = User::factory()->create(['role' => 'admin']);

        $this->actingAs($admin, 'sanctum')->getJson($this->receiptUrl($reservation->id))->assertStatus(403);
    }

    public function test_a_user_without_a_tenant_profile_is_forbidden()
    {
        $reservation = $this->paidReservationOfAnotherTenant();
        $profileless = User::factory()->create(['role' => 'tenant']);

        $this->actingAs($profileless, 'sanctum')->getJson($this->receiptUrl($reservation->id))->assertStatus(403);
    }

    public function test_an_unknown_reservation_id_returns_404()
    {
        [$user] = $this->tenantUser();

        $this->actingAs($user, 'sanctum')->getJson($this->receiptUrl(999999))->assertStatus(404);
    }

    public function test_owner_gets_404_with_a_message_when_the_reservation_is_pending()
    {
        [$user, $tenant] = $this->tenantUser();
        $reservation = $this->reservationFor($tenant, ['status' => 'pending']);
        $this->pay($reservation);

        $response = $this->actingAs($user, 'sanctum')->getJson($this->receiptUrl($reservation->id));

        $response->assertStatus(404);
        $response->assertJsonStructure(['message']);
    }

    public function test_owner_gets_404_when_the_reservation_was_canceled_after_payment()
    {
        [$user, $tenant] = $this->tenantUser();
        $reservation = $this->reservationFor($tenant, ['status' => 'canceled']);
        $this->pay($reservation);

        $this->actingAs($user, 'sanctum')->getJson($this->receiptUrl($reservation->id))
            ->assertStatus(404)
            ->assertJsonStructure(['message']);
    }

    public function test_owner_gets_404_when_a_confirmed_reservation_has_only_pending_or_failed_payments()
    {
        [$user, $tenant] = $this->tenantUser();
        $reservation = $this->reservationFor($tenant);
        $this->pay($reservation, 'pending');
        $this->pay($reservation, 'failed');

        $this->actingAs($user, 'sanctum')->getJson($this->receiptUrl($reservation->id))
            ->assertStatus(404)
            ->assertJsonStructure(['message']);
    }

    public function test_owner_gets_404_when_a_confirmed_reservation_has_no_payment()
    {
        [$user, $tenant] = $this->tenantUser();
        $reservation = $this->reservationFor($tenant);

        $this->actingAs($user, 'sanctum')->getJson($this->receiptUrl($reservation->id))
            ->assertStatus(404)
            ->assertJsonStructure(['message']);
    }

    public function test_another_tenant_gets_403_not_404_on_a_pending_reservation()
    {
        [, $tenant] = $this->tenantUser();
        $reservation = $this->reservationFor($tenant, ['status' => 'pending']);
        [$intruder] = $this->tenantUser();

        $this->actingAs($intruder, 'sanctum')->getJson($this->receiptUrl($reservation->id))->assertStatus(403);
    }

    public function test_owner_downloads_the_pdf_of_a_finished_paid_reservation()
    {
        [$user, $tenant] = $this->tenantUser();
        $reservation = $this->reservationFor($tenant, [
            'start_date' => now()->subDays(40)->toDateString(),
            'end_date' => now()->subDays(10)->toDateString(),
        ]);
        $this->pay($reservation);

        $response = $this->actingAs($user, 'sanctum')->get($this->receiptUrl($reservation->id));

        $response->assertStatus(200);
        $this->assertStringStartsWith('%PDF', $response->getContent());
    }

    /**
     * OR-S18/D6/D13: viewing the receipt stays creator-only -- another
     * member of the SAME org (even an admin) is denied, exactly like any
     * other non-owner, regardless of organization membership.
     */
    public function test_another_org_member_is_forbidden_from_the_creators_receipt_even_as_admin()
    {
        $creator = User::factory()->create(['role' => 'tenant']);
        $creatorTenant = Tenants::factory()->create(['user_id' => $creator->id]);
        $admin = User::factory()->create(['role' => 'tenant']);
        Tenants::factory()->create(['user_id' => $admin->id]);
        Organization::factory()
            ->withMember($creator, OrganizationRole::MEMBER)
            ->withMember($admin, OrganizationRole::ADMIN)
            ->create();
        $reservation = $this->reservationFor($creatorTenant, ['id' => 456]);
        $this->pay($reservation);

        $response = $this->actingAs($admin, 'sanctum')->getJson($this->receiptUrl(456));

        $response->assertStatus(403);
        $this->assertNotSame('application/pdf', $response->headers->get('Content-Type'));
    }

    /**
     * org-wallet OR-S17/OR-S18: the creator downloads the PDF of a wallet-paid
     * org reservation; a different admin of the same org is still denied.
     */
    public function test_the_creator_downloads_the_pdf_of_a_wallet_paid_org_reservation_and_an_admin_does_not()
    {
        [$creator, $creatorTenant] = $this->tenantUser();
        [$admin] = $this->tenantUser();
        $organization = Organization::factory()
            ->withMember($creator, OrganizationRole::MEMBER)
            ->withMember($admin, OrganizationRole::ADMIN)
            ->create(['name' => 'Andina']);
        $reservation = $this->reservationFor($creatorTenant, ['organization_id' => $organization->id]);
        Payments::factory()->create([
            'reservation_id' => $reservation->id,
            'payment_state' => 'paid',
            'payment_method' => 'wallet',
        ]);

        $this->actingAs($creator, 'sanctum')->get($this->receiptUrl($reservation->id))
            ->assertStatus(200)
            ->assertHeader('Content-Type', 'application/pdf');
        $this->actingAs($admin, 'sanctum')->getJson($this->receiptUrl($reservation->id))
            ->assertStatus(403);
    }

    public function test_a_room_title_with_accents_and_markup_still_renders_a_pdf()
    {
        [$user, $tenant] = $this->tenantUser();
        $reservation = $this->reservationFor($tenant, [], ['title' => 'Bodega Peñón Ñandú <b>']);
        $this->pay($reservation);

        $response = $this->actingAs($user, 'sanctum')->get($this->receiptUrl($reservation->id));

        $response->assertStatus(200);
        $this->assertStringStartsWith('%PDF', $response->getContent());
    }
}
