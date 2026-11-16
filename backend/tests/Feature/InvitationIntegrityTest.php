<?php

namespace Tests\Feature;

use App\Enums\InvitationStatus;
use App\Enums\OrganizationRole;
use App\Models\Notifications;
use App\Models\Organization;
use App\Models\OrganizationInvitation;
use App\Models\Reservations;
use App\Models\StoreRooms;
use App\Models\Tenants;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Notification;
use Illuminate\Testing\TestResponse;
use Tests\TestCase;

/**
 * huc-14 U1b INV-22: deleting an account cascades as the schema already
 * defines (characterization: no production change, no migration). Invitations
 * addressed to the user, memberships and notifications sent or received by the
 * user go away; invitations created by a deleted inviter stay with a null
 * inviter.
 */
class InvitationIntegrityTest extends TestCase
{
    use RefreshDatabase;

    private Organization $organization;

    private User $admin;

    private User $invitee;

    protected function setUp(): void
    {
        parent::setUp();

        Notification::fake();
        Mail::fake();

        $this->admin = User::factory()->create(['role' => 'tenant', 'state' => 'active']);
        $this->invitee = User::factory()->create(['role' => 'tenant', 'state' => 'active']);
        $this->organization = Organization::factory()->withMember($this->admin, OrganizationRole::ADMIN)->create();
    }

    private function invitation(?Organization $organization = null): OrganizationInvitation
    {
        return OrganizationInvitation::factory()->create([
            'organization_id' => ($organization ?? $this->organization)->id,
            'invited_user_id' => $this->invitee->id,
            'invited_by_user_id' => $this->admin->id,
            'email' => strtolower($this->invitee->email),
        ]);
    }

    private function respond(string $action, OrganizationInvitation $invitation): TestResponse
    {
        return $this->actingAs($this->invitee, 'sanctum')->postJson("/api/invitations/{$invitation->id}/{$action}");
    }

    private function deleteAccountOf(User $user): TestResponse
    {
        return $this->actingAs($user, 'sanctum')->deleteJson('/api/account');
    }

    // INV-S223
    public function test_deleting_the_invitee_removes_the_pending_invitation_and_leaves_no_orphan()
    {
        $invitation = $this->invitation();

        $this->deleteAccountOf($this->invitee)->assertOk();

        $this->assertDatabaseMissing('user', ['id' => $this->invitee->id]);
        $this->assertDatabaseMissing('organization_invitations', ['id' => $invitation->id]);
        $this->assertSame(0, DB::table('organization_invitations')->where('invited_user_id', $this->invitee->id)->count());
    }

    // INV-S224
    public function test_deleting_an_invitee_who_accepted_removes_the_membership_and_the_invitation_only()
    {
        $invitation = $this->invitation();
        $this->respond('accept', $invitation)->assertOk();

        $this->deleteAccountOf($this->invitee)->assertOk();

        $this->assertDatabaseMissing('organization_invitations', ['id' => $invitation->id]);
        $this->assertDatabaseMissing('organization_user', ['user_id' => $this->invitee->id]);
        $this->assertDatabaseHas('organizations', ['id' => $this->organization->id]);
        $this->assertDatabaseHas('organization_user', [
            'organization_id' => $this->organization->id,
            'user_id' => $this->admin->id,
            'role' => 'admin',
        ]);
        $this->assertSame('0.00', $this->organization->fresh()->wallet_balance);
        $this->assertSame(0, DB::table('organization_wallet_movements')->count());
    }

    // INV-S225
    public function test_deleting_the_invitee_removes_the_admin_notifications_it_sent()
    {
        $this->respond('accept', $this->invitation())->assertOk();
        $this->assertSame(1, Notifications::query()->where('sender_id', $this->invitee->id)->count());

        $this->deleteAccountOf($this->invitee)->assertOk();

        $this->assertSame(0, Notifications::query()->where('type', 'organization_invitation_accepted')->count());
    }

    // INV-S226
    public function test_an_active_organization_hold_still_blocks_the_deletion_and_keeps_the_invitation()
    {
        $invitation = $this->invitation();
        $tenant = Tenants::factory()->create(['user_id' => $this->invitee->id]);
        $holding = Organization::factory()->create();
        Reservations::factory()->create([
            'store_room_id' => StoreRooms::factory()->create()->id,
            'tenant_id' => $tenant->id,
            'organization_id' => $holding->id,
            'status' => 'confirmed',
            'end_date' => today()->addDays(10)->toDateString(),
        ]);

        $this->deleteAccountOf($this->invitee)
            ->assertStatus(409)
            ->assertExactJson(['message' => 'No puedes eliminar tu cuenta mientras tengas reservas activas a nombre de una organización']);

        $this->assertDatabaseHas('user', ['id' => $this->invitee->id]);
        $this->assertSame(InvitationStatus::Pending, $invitation->fresh()->status);
    }

    // INV-S227
    public function test_deleting_the_inviter_keeps_the_invitation_with_a_null_inviter_name()
    {
        $invitation = $this->invitation();

        $this->deleteAccountOf($this->admin)->assertOk();

        $this->assertNull($invitation->fresh()->invited_by_user_id);
        $item = $this->actingAs($this->invitee, 'sanctum')->getJson('/api/invitations')->assertOk()->json('data.0');
        $this->assertSame($invitation->id, $item['id']);
        $this->assertNull($item['invited_by_name']);
    }

    // INV-S228
    public function test_a_deleted_organization_drops_its_pending_invitation_from_the_inbox_and_accept_is_404()
    {
        $invitation = $this->invitation();

        $this->organization->delete();

        $this->actingAs($this->invitee, 'sanctum')->getJson('/api/invitations')
            ->assertOk()
            ->assertExactJson(['data' => [], 'pending_count' => 0]);
        $this->respond('accept', $invitation)
            ->assertStatus(404)
            ->assertExactJson(['message' => 'Invitación no encontrada']);
    }

    // INV-S229
    public function test_the_token_of_a_deleted_invitee_no_longer_authenticates()
    {
        $this->invitation();
        $token = $this->invitee->createToken('auth_token')->plainTextToken;

        $this->withToken($token)->deleteJson('/api/account')->assertOk();
        $this->app['auth']->forgetGuards();

        $this->withToken($token)->getJson('/api/invitations')->assertStatus(401);
    }

    // INV-S230
    public function test_a_reject_succeeds_with_zero_notifications_when_every_admin_account_is_gone()
    {
        $invitation = $this->invitation();
        $this->deleteAccountOf($this->admin)->assertOk();

        $this->respond('reject', $invitation)->assertOk()->assertJsonPath('status', 'rejected');

        $this->assertSame(0, Notifications::query()->count());
        $this->assertSame(InvitationStatus::Rejected, $invitation->fresh()->status);
    }
}
