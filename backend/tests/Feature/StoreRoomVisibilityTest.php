<?php

namespace Tests\Feature;

use App\Models\Landlords;
use App\Models\StoreRooms;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Role matrix for the two public listing routes (spec #162, domain
 * storeroom-listing). Both routes stay unmiddlewared and anonymously
 * reachable; the role filtering happens inside
 * StoreRooms::scopeVisibleTo(), fed by an explicitly resolved
 * auth('sanctum')->user().
 */
class StoreRoomVisibilityTest extends TestCase
{
    use RefreshDatabase;

    private function seedMixedStatuses(int $landlordId): void
    {
        StoreRooms::factory()->create(['landlord_id' => $landlordId, 'publication_status' => 'approved']);
        StoreRooms::factory()->create(['landlord_id' => $landlordId, 'publication_status' => 'pending']);
        StoreRooms::factory()->create(['landlord_id' => $landlordId, 'publication_status' => 'rejected']);
    }

    private function statusesFrom(array $body): array
    {
        return collect($body)->pluck('publication_status')->unique()->sort()->values()->all();
    }

    // -- index() --------------------------------------------------------

    public function test_index_anonymous_sees_only_approved(): void
    {
        $landlord = Landlords::factory()->create();
        $this->seedMixedStatuses($landlord->id);

        $response = $this->getJson('/api/storeRooms');

        $response->assertStatus(200);
        $this->assertSame(['approved'], $this->statusesFrom($response->json()));
    }

    public function test_index_tenant_sees_only_approved(): void
    {
        $landlord = Landlords::factory()->create();
        $this->seedMixedStatuses($landlord->id);

        $tenant = User::factory()->create(['role' => 'tenant']);

        $response = $this->actingAs($tenant, 'sanctum')->getJson('/api/storeRooms');

        $response->assertStatus(200);
        $this->assertSame(['approved'], $this->statusesFrom($response->json()));
    }

    public function test_index_landlord_does_not_see_own_pending_via_public_catalog(): void
    {
        $landlordUser = User::factory()->create(['role' => 'landlord']);
        $landlord = Landlords::factory()->create(['user_id' => $landlordUser->id]);
        $this->seedMixedStatuses($landlord->id);

        $response = $this->actingAs($landlordUser, 'sanctum')->getJson('/api/storeRooms');

        $response->assertStatus(200);
        $this->assertSame(['approved'], $this->statusesFrom($response->json()));
    }

    /**
     * GUARD CANARY: this is the test that fails if index() ever resolves the
     * viewer via bare auth()->user() instead of auth('sanctum')->user().
     * config/auth.php sets the default guard to `web`; on this unmiddlewared
     * route a bare call returns null even for a valid Bearer token, which
     * would silently downgrade this admin to the `approved`-only branch.
     * Do not "simplify" this test away.
     */
    public function test_index_admin_sees_all_statuses_guard_canary(): void
    {
        $landlord = Landlords::factory()->create();
        $this->seedMixedStatuses($landlord->id);

        $admin = User::factory()->create(['role' => 'admin']);

        $response = $this->actingAs($admin, 'sanctum')->getJson('/api/storeRooms');

        $response->assertStatus(200);
        $this->assertSame(['approved', 'pending', 'rejected'], $this->statusesFrom($response->json()));
    }

    // -- getByLandlord() -------------------------------------------------

    public function test_get_by_landlord_anonymous_sees_only_approved(): void
    {
        $landlord = Landlords::factory()->create();
        $this->seedMixedStatuses($landlord->id);

        $response = $this->getJson("/api/landlords/{$landlord->id}/storeRooms");

        $response->assertStatus(200);
        $this->assertSame(['approved'], $this->statusesFrom($response->json()));
    }

    public function test_get_by_landlord_owning_landlord_sees_all_statuses(): void
    {
        $landlordUser = User::factory()->create(['role' => 'landlord']);
        $landlord = Landlords::factory()->create(['user_id' => $landlordUser->id]);
        $this->seedMixedStatuses($landlord->id);

        $response = $this->actingAs($landlordUser, 'sanctum')->getJson("/api/landlords/{$landlord->id}/storeRooms");

        $response->assertStatus(200);
        $this->assertSame(['approved', 'pending', 'rejected'], $this->statusesFrom($response->json()));
    }

    public function test_get_by_landlord_other_landlord_sees_only_approved(): void
    {
        $ownerLandlord = Landlords::factory()->create();
        $this->seedMixedStatuses($ownerLandlord->id);

        $otherUser = User::factory()->create(['role' => 'landlord']);
        Landlords::factory()->create(['user_id' => $otherUser->id]);

        $response = $this->actingAs($otherUser, 'sanctum')->getJson("/api/landlords/{$ownerLandlord->id}/storeRooms");

        $response->assertStatus(200);
        $this->assertSame(['approved'], $this->statusesFrom($response->json()));
    }

    public function test_get_by_landlord_admin_sees_all_statuses(): void
    {
        $landlord = Landlords::factory()->create();
        $this->seedMixedStatuses($landlord->id);

        $admin = User::factory()->create(['role' => 'admin']);

        $response = $this->actingAs($admin, 'sanctum')->getJson("/api/landlords/{$landlord->id}/storeRooms");

        $response->assertStatus(200);
        $this->assertSame(['approved', 'pending', 'rejected'], $this->statusesFrom($response->json()));
    }
}
