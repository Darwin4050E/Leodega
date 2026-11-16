<?php

namespace Tests\Unit;

use App\Enums\OrganizationRole;
use App\Models\Landlords;
use App\Models\Organization;
use App\Models\Reservations;
use App\Models\StoreRooms;
use App\Models\Tenants;
use App\Models\User;
use App\Policies\ReservationsPolicy;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * `cancelAsTenant()` mirrors the PaymentsPolicy::create ownership idiom
 * (`backend/app/Policies/PaymentsPolicy.php:16-21`): identity only, no
 * eligibility -- that belongs to ReservationService::cancelByTenant().
 */
class ReservationsPolicyCancelAsTenantTest extends TestCase
{
    use RefreshDatabase;

    public function test_owning_tenant_is_authorized()
    {
        $tenantUser = User::factory()->create();
        $tenant = Tenants::factory()->create(['user_id' => $tenantUser->id]);
        $room = StoreRooms::factory()->create();
        $reservation = Reservations::factory()->create([
            'store_room_id' => $room->id,
            'tenant_id' => $tenant->id,
        ]);

        $allowed = (new ReservationsPolicy)->cancelAsTenant($tenantUser, $reservation);

        $this->assertTrue($allowed);
    }

    public function test_a_different_tenant_is_not_authorized()
    {
        $tenant = Tenants::factory()->create();
        $room = StoreRooms::factory()->create();
        $reservation = Reservations::factory()->create([
            'store_room_id' => $room->id,
            'tenant_id' => $tenant->id,
        ]);

        $otherUser = User::factory()->create();
        Tenants::factory()->create(['user_id' => $otherUser->id]);

        $allowed = (new ReservationsPolicy)->cancelAsTenant($otherUser, $reservation);

        $this->assertFalse($allowed);
    }

    public function test_the_room_landlord_is_not_authorized()
    {
        $tenant = Tenants::factory()->create();
        $landlordUser = User::factory()->create(['role' => 'landlord']);
        $landlord = Landlords::factory()->create(['user_id' => $landlordUser->id]);
        $room = StoreRooms::factory()->create(['landlord_id' => $landlord->id]);
        $reservation = Reservations::factory()->create([
            'store_room_id' => $room->id,
            'tenant_id' => $tenant->id,
        ]);

        $allowed = (new ReservationsPolicy)->cancelAsTenant($landlordUser, $reservation);

        $this->assertFalse($allowed);
    }

    /**
     * HUE-06 OR-13/OR-17: an organization reservation is cancellable only by an
     * admin of ITS organization, read from the live pivot.
     *
     * @return array{0: Reservations, 1: Organization, 2: User}
     */
    private function organizationReservation(): array
    {
        $creator = User::factory()->create();
        $tenant = Tenants::factory()->create(['user_id' => $creator->id]);
        $organization = Organization::factory()->withMember($creator, OrganizationRole::MEMBER)->create();
        $reservation = Reservations::factory()->forOrganization($organization)->create([
            'store_room_id' => StoreRooms::factory()->create()->id,
            'tenant_id' => $tenant->id,
        ]);

        return [$reservation, $organization, $creator];
    }

    private function userWithRole(Organization $organization, OrganizationRole $role): User
    {
        $user = User::factory()->create();
        $organization->users()->attach($user->id, ['role' => $role->value]);

        return $user;
    }

    public function test_an_admin_who_is_not_the_creator_is_authorized_on_an_organization_reservation()
    {
        [$reservation, $organization] = $this->organizationReservation();
        $admin = $this->userWithRole($organization, OrganizationRole::ADMIN);

        $this->assertTrue((new ReservationsPolicy)->cancelAsTenant($admin, $reservation));
    }

    public function test_the_creator_member_and_other_members_are_denied_on_an_organization_reservation()
    {
        [$reservation, $organization, $creator] = $this->organizationReservation();
        $otherMember = $this->userWithRole($organization, OrganizationRole::MEMBER);

        $this->assertFalse((new ReservationsPolicy)->cancelAsTenant($creator, $reservation));
        $this->assertFalse((new ReservationsPolicy)->cancelAsTenant($otherMember, $reservation));
    }

    public function test_a_non_member_an_other_org_admin_and_a_landlord_are_denied_on_an_organization_reservation()
    {
        [$reservation] = $this->organizationReservation();
        $nonMember = User::factory()->create();
        $otherOrgAdmin = User::factory()->create();
        Organization::factory()->withMember($otherOrgAdmin, OrganizationRole::ADMIN)->create();
        $landlordUser = User::factory()->create(['role' => 'landlord']);
        Landlords::factory()->create(['user_id' => $landlordUser->id]);

        $policy = new ReservationsPolicy;

        $this->assertFalse($policy->cancelAsTenant($nonMember, $reservation));
        $this->assertFalse($policy->cancelAsTenant($otherOrgAdmin, $reservation));
        $this->assertFalse($policy->cancelAsTenant($landlordUser, $reservation));
    }

    public function test_a_demoted_admin_is_denied_because_the_role_is_read_from_the_database()
    {
        [$reservation, $organization] = $this->organizationReservation();
        $admin = $this->userWithRole($organization, OrganizationRole::ADMIN);
        $this->assertTrue((new ReservationsPolicy)->cancelAsTenant($admin, $reservation));

        $organization->users()->updateExistingPivot($admin->id, ['role' => OrganizationRole::MEMBER->value]);

        $this->assertFalse((new ReservationsPolicy)->cancelAsTenant($admin, $reservation));
    }

    public function test_a_personal_reservation_stays_owner_only_even_for_an_organization_admin()
    {
        $ownerUser = User::factory()->create();
        $tenant = Tenants::factory()->create(['user_id' => $ownerUser->id]);
        $reservation = Reservations::factory()->create([
            'store_room_id' => StoreRooms::factory()->create()->id,
            'tenant_id' => $tenant->id,
        ]);
        $orgAdmin = User::factory()->create();
        Organization::factory()->withMember($orgAdmin, OrganizationRole::ADMIN)->create();

        $this->assertTrue((new ReservationsPolicy)->cancelAsTenant($ownerUser, $reservation));
        $this->assertFalse((new ReservationsPolicy)->cancelAsTenant($orgAdmin, $reservation));
    }
}
