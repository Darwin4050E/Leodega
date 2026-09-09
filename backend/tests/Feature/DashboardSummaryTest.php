<?php

namespace Tests\Feature;

use App\Models\Reports;
use App\Models\Reservations;
use App\Models\StoreRooms;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * DashboardController::summary() — GET /dashboard/summary. Admin-only,
 * mirroring StoreModerationQueueTest.php's skeleton.
 */
class DashboardSummaryTest extends TestCase
{
    use RefreshDatabase;

    private function makeUser(string $role): User
    {
        return User::factory()->create(['role' => $role]);
    }

    public function test_summary_requires_authentication(): void
    {
        $response = $this->getJson('/api/dashboard/summary');

        $response->assertStatus(401);
    }

    public function test_summary_is_forbidden_for_tenant(): void
    {
        $tenant = $this->makeUser('tenant');

        $response = $this->actingAs($tenant, 'sanctum')->getJson('/api/dashboard/summary');

        $response->assertStatus(403);
    }

    public function test_summary_is_forbidden_for_landlord(): void
    {
        $landlord = $this->makeUser('landlord');

        $response = $this->actingAs($landlord, 'sanctum')->getJson('/api/dashboard/summary');

        $response->assertStatus(403);
    }

    public function test_summary_returns_all_zeros_for_empty_database(): void
    {
        $admin = $this->makeUser('admin');

        $response = $this->actingAs($admin, 'sanctum')->getJson('/api/dashboard/summary');

        $response->assertStatus(200);
        $response->assertJson([
            'active_store_rooms' => 0,
            'pending_moderation' => 0,
            'reservations_this_month' => 0,
            'open_reports' => 0,
            'accounts' => ['total' => 0, 'blocked' => 0],
        ]);
    }

    public function test_summary_counts_active_and_pending_store_rooms(): void
    {
        $admin = $this->makeUser('admin');

        StoreRooms::factory()->count(2)->create(['publication_status' => 'approved']);
        StoreRooms::factory()->create(['publication_status' => 'pending']);
        StoreRooms::factory()->create(['publication_status' => 'rejected']);

        $response = $this->actingAs($admin, 'sanctum')->getJson('/api/dashboard/summary');

        $response->assertStatus(200);
        $response->assertJsonPath('active_store_rooms', 2);
        $response->assertJsonPath('pending_moderation', 1);
    }

    /**
     * `created_at` isn't fillable on Reservations, so it's set via
     * forceFill() after creation — this is what proves the metric reads
     * `created_at`, never the legacy `creation_date` column.
     */
    public function test_summary_counts_only_confirmed_reservations_created_this_month(): void
    {
        $admin = $this->makeUser('admin');

        Reservations::factory()->create(['status' => 'confirmed'])
            ->forceFill(['created_at' => now()])->save();
        // Pending reservation created this month is excluded.
        Reservations::factory()->create(['status' => 'pending'])
            ->forceFill(['created_at' => now()])->save();
        // Confirmed reservation created last month is excluded.
        Reservations::factory()->create(['status' => 'confirmed'])
            ->forceFill(['created_at' => now()->subMonthNoOverflow()])->save();

        $response = $this->actingAs($admin, 'sanctum')->getJson('/api/dashboard/summary');

        $response->assertStatus(200);
        $response->assertJsonPath('reservations_this_month', 1);
    }

    public function test_summary_open_reports_counts_only_pending(): void
    {
        $admin = $this->makeUser('admin');

        Reports::factory()->create(['status' => 'pending']);
        Reports::factory()->create(['status' => 'resolved']);
        Reports::factory()->create(['status' => 'canceled']);

        $response = $this->actingAs($admin, 'sanctum')->getJson('/api/dashboard/summary');

        $response->assertStatus(200);
        $response->assertJsonPath('open_reports', 1);
    }

    public function test_summary_accounts_excludes_admins_and_reports_blocked_subset(): void
    {
        $admin = $this->makeUser('admin');

        $this->makeUser('admin');
        User::factory()->create(['role' => 'landlord', 'state' => 'active']);
        User::factory()->create(['role' => 'tenant', 'state' => 'blocked']);

        $response = $this->actingAs($admin, 'sanctum')->getJson('/api/dashboard/summary');

        $response->assertStatus(200);
        $response->assertJsonPath('accounts.total', 2);
        $response->assertJsonPath('accounts.blocked', 1);
    }
}
