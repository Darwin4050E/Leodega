<?php

namespace Tests\Feature;

use App\Models\AccountModeration;
use App\Models\StoreModeration;
use App\Models\StoreRooms;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * DashboardController::activity() — GET /dashboard/activity. Admin-only,
 * mirroring StoreModerationQueueTest.php's skeleton.
 */
class DashboardActivityTest extends TestCase
{
    use RefreshDatabase;

    private function makeUser(string $role): User
    {
        return User::factory()->create(['role' => $role]);
    }

    public function test_activity_requires_authentication(): void
    {
        $response = $this->getJson('/api/dashboard/activity');

        $response->assertStatus(401);
    }

    public function test_activity_is_forbidden_for_tenant(): void
    {
        $tenant = $this->makeUser('tenant');

        $response = $this->actingAs($tenant, 'sanctum')->getJson('/api/dashboard/activity');

        $response->assertStatus(403);
    }

    public function test_activity_is_forbidden_for_landlord(): void
    {
        $landlord = $this->makeUser('landlord');

        $response = $this->actingAs($landlord, 'sanctum')->getJson('/api/dashboard/activity');

        $response->assertStatus(403);
    }

    public function test_activity_returns_empty_array_when_both_tables_are_empty(): void
    {
        $admin = $this->makeUser('admin');

        $response = $this->actingAs($admin, 'sanctum')->getJson('/api/dashboard/activity');

        $response->assertStatus(200);
        $response->assertExactJson([]);
    }

    /**
     * Regression test for the moderation_date-vs-created_at risk (design
     * #197): a store_moderation row (date-precision moderation_date) and
     * an account_moderation row (timestamp-precision moderation_date) on
     * the SAME calendar day, different times — sorting by created_at must
     * still put the later one first.
     */
    public function test_entries_are_merged_and_ordered_newest_first_across_tables(): void
    {
        $admin = $this->makeUser('admin');
        $storeRoom = StoreRooms::factory()->create();
        $targetUser = $this->makeUser('tenant');

        $today = now()->startOfDay();

        $storeModeration = StoreModeration::create([
            'store_id' => $storeRoom->id,
            'status' => 'approved',
            'reason_rejected' => '',
            'admin_id' => $admin->id,
        ]);
        $storeModeration->forceFill(['created_at' => $today->copy()->addHours(9)])->save();

        $accountModeration = AccountModeration::create([
            'user_id' => $targetUser->id,
            'admin_id' => $admin->id,
            'action' => 'block',
        ]);
        $accountModeration->forceFill(['created_at' => $today->copy()->addHours(23)])->save();

        $response = $this->actingAs($admin, 'sanctum')->getJson('/api/dashboard/activity');

        $response->assertStatus(200);
        $response->assertJsonCount(2);
        $response->assertJsonPath('0.id', "account:{$accountModeration->id}");
        $response->assertJsonPath('1.id', "store:{$storeModeration->id}");
    }

    public function test_limit_is_respected(): void
    {
        $admin = $this->makeUser('admin');
        $storeRoom = StoreRooms::factory()->create();

        for ($i = 0; $i < 5; $i++) {
            StoreModeration::create([
                'store_id' => $storeRoom->id,
                'status' => 'approved',
                'reason_rejected' => '',
                'admin_id' => $admin->id,
            ]);
        }

        $response = $this->actingAs($admin, 'sanctum')->getJson('/api/dashboard/activity?limit=2');

        $response->assertStatus(200);
        $response->assertJsonCount(2);
    }

    public function test_action_and_tone_are_machine_values_for_all_four_canonicalizations(): void
    {
        $admin = $this->makeUser('admin');
        $storeRoom = StoreRooms::factory()->create();
        $userOne = $this->makeUser('tenant');
        $userTwo = $this->makeUser('tenant');

        StoreModeration::create([
            'store_id' => $storeRoom->id,
            'status' => 'rejected',
            'reason_rejected' => 'Fotos borrosas',
            'admin_id' => $admin->id,
        ]);
        StoreModeration::create([
            'store_id' => $storeRoom->id,
            'status' => 'approved',
            'reason_rejected' => '',
            'admin_id' => $admin->id,
        ]);
        AccountModeration::create([
            'user_id' => $userOne->id,
            'admin_id' => $admin->id,
            'action' => 'block',
        ]);
        AccountModeration::create([
            'user_id' => $userTwo->id,
            'admin_id' => $admin->id,
            'action' => 'reactivate',
        ]);

        $response = $this->actingAs($admin, 'sanctum')->getJson('/api/dashboard/activity');

        $response->assertStatus(200);
        $actions = collect($response->json())->pluck('action')->all();
        $tones = collect($response->json())->pluck('tone')->all();

        $this->assertContains('rejected', $actions);
        $this->assertContains('approved', $actions);
        $this->assertContains('blocked', $actions);
        $this->assertContains('reactivated', $actions);
        $this->assertContains('err', $tones);
        $this->assertContains('ok', $tones);
    }

    public function test_null_actor_is_included_without_error(): void
    {
        $admin = $this->makeUser('admin');
        $storeRoom = StoreRooms::factory()->create();

        StoreModeration::create([
            'store_id' => $storeRoom->id,
            'status' => 'approved',
            'reason_rejected' => '',
            'admin_id' => null,
        ]);

        $response = $this->actingAs($admin, 'sanctum')->getJson('/api/dashboard/activity');

        $response->assertStatus(200);
        $response->assertJsonCount(1);
        $response->assertJsonPath('0.actor', null);
    }
}
