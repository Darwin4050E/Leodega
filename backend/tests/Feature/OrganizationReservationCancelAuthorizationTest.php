<?php

namespace Tests\Feature;

use App\Enums\OrganizationRole;
use App\Models\Landlords;
use App\Models\Organization;
use App\Models\Reservations;
use App\Models\StoreRooms;
use App\Models\Tenants;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Notification;
use Illuminate\Testing\TestResponse;
use Tests\TestCase;

/**
 * HUE-06 U1a: cancel and preview of an organization reservation are admin-only
 * (OR-13), authorized before the body is validated (OR-15) and derived from
 * the reservation, never from the X-Organization-Id header (OR-17).
 */
class OrganizationReservationCancelAuthorizationTest extends TestCase
{
    use RefreshDatabase;

    private const DENIED = 'No autorizado';

    private const REASON = 'Cambio de planes internos';

    private Organization $organization;

    private User $creator;

    private User $admin;

    private User $otherMember;

    private User $nonMember;

    private User $otherOrgAdmin;

    private Organization $otherOrganization;

    private User $landlordUser;

    protected function setUp(): void
    {
        parent::setUp();

        Notification::fake();

        $this->creator = $this->tenantUser();
        $this->admin = $this->tenantUser();
        $this->otherMember = $this->tenantUser();
        $this->nonMember = $this->tenantUser();
        $this->otherOrgAdmin = $this->tenantUser();
        $this->organization = Organization::factory()
            ->withBalance('1000.00')
            ->withMember($this->creator, OrganizationRole::MEMBER)
            ->withMember($this->admin, OrganizationRole::ADMIN)
            ->withMember($this->otherMember, OrganizationRole::MEMBER)
            ->create();
        $this->otherOrganization = Organization::factory()
            ->withMember($this->otherOrgAdmin, OrganizationRole::ADMIN)
            ->create();
        $this->landlordUser = User::factory()->create(['role' => 'landlord']);
        Landlords::factory()->create(['user_id' => $this->landlordUser->id]);
    }

    private function tenantUser(): User
    {
        $user = User::factory()->create(['role' => 'tenant']);
        Tenants::factory()->create(['user_id' => $user->id]);

        return $user;
    }

    private function organizationReservation(?User $creator = null, array $overrides = []): Reservations
    {
        return Reservations::factory()->forOrganization($this->organization)->create(array_merge([
            'store_room_id' => StoreRooms::factory()->approved()->create()->id,
            'tenant_id' => ($creator ?? $this->creator)->tenant->id,
            'status' => 'confirmed',
            'start_date' => now()->addDays(10)->toDateString(),
            'end_date' => now()->addDays(40)->toDateString(),
            'total_mount' => '100.00',
            'cancellation_policy_tier' => 'flexible',
        ], $overrides));
    }

    private function cancel(Reservations $reservation, ?User $as, array $body = ['reason' => self::REASON], array $headers = []): TestResponse
    {
        $request = $as ? $this->actingAs($as, 'sanctum') : $this;

        return $request->patchJson("/api/tenant/reservations/{$reservation->id}/cancel", $body, $headers);
    }

    private function preview(Reservations $reservation, ?User $as): TestResponse
    {
        $request = $as ? $this->actingAs($as, 'sanctum') : $this;

        return $request->getJson("/api/tenant/reservations/{$reservation->id}/cancellation-preview");
    }

    private function assertDenied(TestResponse $response): void
    {
        $response->assertStatus(403);
        $this->assertSame(['message'], array_keys($response->json()));
        $this->assertSame(self::DENIED, $response->json('message'));
    }

    private function assertUntouched(Reservations $reservation): void
    {
        $this->assertDatabaseHas('reservations', ['id' => $reservation->id, 'status' => 'confirmed', 'cancelation_reason' => null]);
        $this->assertSame('1000.00', $this->organization->fresh()->wallet_balance);
        $this->assertSame(0, DB::table('organization_wallet_movements')->count());
    }

    // -- OR-15: authorize before validate --

    public function test_a_member_creator_gets_403_not_422_on_an_empty_body()
    {
        $reservation = $this->organizationReservation();

        $response = $this->cancel($reservation, $this->creator, []);

        $this->assertDenied($response);
        $this->assertUntouched($reservation);
    }

    public function test_a_non_member_gets_403_not_422_on_a_short_reason()
    {
        $reservation = $this->organizationReservation();

        $this->assertDenied($this->cancel($reservation, $this->nonMember, ['reason' => 'abc']));
        $this->assertUntouched($reservation);
    }

    public function test_an_admin_with_a_short_reason_gets_422_and_nothing_changes()
    {
        $reservation = $this->organizationReservation();

        $this->cancel($reservation, $this->admin, ['reason' => 'abc'])->assertStatus(422);

        $this->assertUntouched($reservation);
    }

    // -- OR-13: admin allowed, everyone else denied --

    public function test_an_admin_who_is_not_the_creator_cancels_and_the_refund_follows_the_tier()
    {
        $reservation = $this->organizationReservation();

        $this->cancel($reservation, $this->admin)->assertOk();

        $this->assertDatabaseHas('reservations', [
            'id' => $reservation->id,
            'status' => 'canceled',
            'cancelation_reason' => self::REASON,
            'refund_amount' => '100.00',
        ]);
    }

    public function test_an_admin_who_is_also_the_creator_can_cancel_own_reservation()
    {
        $reservation = $this->organizationReservation($this->admin);

        $this->cancel($reservation, $this->admin)->assertOk();

        $this->assertDatabaseHas('reservations', ['id' => $reservation->id, 'status' => 'canceled']);
    }

    public function test_the_creator_who_is_only_a_member_is_denied_on_cancel_and_preview()
    {
        $reservation = $this->organizationReservation();

        $this->assertDenied($this->cancel($reservation, $this->creator));
        $this->assertDenied($this->preview($reservation, $this->creator));
        $this->assertUntouched($reservation);
    }

    public function test_another_member_is_denied_on_cancel_and_preview()
    {
        $reservation = $this->organizationReservation();

        $this->assertDenied($this->cancel($reservation, $this->otherMember));
        $this->assertDenied($this->preview($reservation, $this->otherMember));
        $this->assertUntouched($reservation);
    }

    public function test_a_demoted_admin_is_denied_immediately()
    {
        $reservation = $this->organizationReservation();
        $this->organization->users()->updateExistingPivot($this->admin->id, ['role' => OrganizationRole::MEMBER->value]);

        $this->assertDenied($this->cancel($reservation, $this->admin));
        $this->assertUntouched($reservation);
    }

    public function test_an_inactive_organization_does_not_block_an_admin_cancel()
    {
        $reservation = $this->organizationReservation();
        $this->organization->update(['status' => 'inactive']);

        $this->cancel($reservation, $this->admin)->assertOk();

        $this->assertDatabaseHas('reservations', ['id' => $reservation->id, 'status' => 'canceled']);
    }

    public function test_an_ineligible_organization_reservation_is_rejected_for_an_admin_without_changes()
    {
        $started = $this->organizationReservation(null, ['start_date' => now()->toDateString()]);
        $canceled = $this->organizationReservation(null, ['status' => 'canceled']);

        $this->cancel($started, $this->admin)->assertStatus(409);
        $this->cancel($canceled, $this->admin)->assertStatus(409);

        $this->assertDatabaseHas('reservations', ['id' => $started->id, 'status' => 'confirmed']);
        $this->assertSame('1000.00', $this->organization->fresh()->wallet_balance);
    }

    // -- OR-S34, OR-S35, OR-S84: the same 403 for every denied caller --

    public function test_every_denied_caller_gets_the_identical_403_body_on_cancel_and_preview()
    {
        $reservation = $this->organizationReservation();
        $callers = [
            'member' => $this->otherMember,
            'non member' => $this->nonMember,
            'other org admin' => $this->otherOrgAdmin,
            'landlord' => $this->landlordUser,
        ];

        foreach ($callers as $label => $caller) {
            $cancel = $this->cancel($reservation, $caller);
            $preview = $this->preview($reservation, $caller);

            $this->assertDenied($cancel);
            $this->assertDenied($preview);
            $this->assertSame(['message' => self::DENIED], $cancel->json(), $label);
        }
        $this->assertUntouched($reservation);
    }

    public function test_a_personal_reservation_stays_owner_only_with_the_same_denied_body()
    {
        $owner = $this->tenantUser();
        $personal = Reservations::factory()->create([
            'store_room_id' => StoreRooms::factory()->approved()->create()->id,
            'tenant_id' => $owner->tenant->id,
            'status' => 'confirmed',
            'start_date' => now()->addDays(10)->toDateString(),
            'end_date' => now()->addDays(40)->toDateString(),
            'cancellation_policy_tier' => 'flexible',
        ]);

        $this->assertDenied($this->cancel($personal, $this->nonMember, []));
        $this->assertDenied($this->preview($personal, $this->nonMember));
        $this->assertDenied($this->cancel($personal, $this->admin, []));
        $this->assertDatabaseHas('reservations', ['id' => $personal->id, 'status' => 'confirmed']);

        $this->cancel($personal, $owner, [])->assertOk();
        $this->assertDatabaseHas('reservations', ['id' => $personal->id, 'status' => 'canceled']);
    }

    public function test_unauthenticated_callers_get_401_and_a_missing_reservation_keeps_the_404()
    {
        $reservation = $this->organizationReservation();

        $cancel = $this->cancel($reservation, null);
        $cancel->assertStatus(401);
        $this->assertSame('Unauthenticated.', $cancel->json('message'));
        $this->preview($reservation, null)->assertStatus(401);

        $this->actingAs($this->admin, 'sanctum')
            ->patchJson('/api/tenant/reservations/999999/cancel', ['reason' => self::REASON])
            ->assertStatus(404);
    }

    // -- OR-17 / OR-S54: the header is ignored --

    public function test_the_organization_header_never_changes_the_outcome()
    {
        foreach ([[(string) $this->otherOrganization->id], ['abc'], []] as $header) {
            $reservation = $this->organizationReservation();
            $headers = $header ? ['X-Organization-Id' => $header[0]] : [];

            $this->cancel($reservation, $this->admin, ['reason' => self::REASON], $headers)->assertOk();
            $this->assertDatabaseHas('reservations', ['id' => $reservation->id, 'status' => 'canceled']);
        }

        $memberAttempt = $this->organizationReservation();
        $this->assertDenied($this->cancel(
            $memberAttempt,
            $this->creator,
            ['reason' => self::REASON],
            ['X-Organization-Id' => (string) $this->organization->id],
        ));
    }
}
