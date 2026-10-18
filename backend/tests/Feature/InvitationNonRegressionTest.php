<?php

namespace Tests\Feature;

use App\Enums\InvitationStatus;
use App\Enums\OrganizationRole;
use App\Models\Organization;
use App\Models\OrganizationInvitation;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Notification;
use Illuminate\Testing\TestResponse;
use Tests\TestCase;

/**
 * huc-14 U1b INV-23: the responses are reflected on the admin side of HUE-01
 * and nothing else of the organization surface moved (characterization: no
 * production change).
 */
class InvitationNonRegressionTest extends TestCase
{
    use RefreshDatabase;

    private const IC12_UNAVAILABLE = 'Esta invitación ya no está disponible';

    private const IC2_ALREADY_MEMBER = 'Este usuario ya es miembro de tu organización';

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

    private function invitation(): OrganizationInvitation
    {
        return OrganizationInvitation::factory()->create([
            'organization_id' => $this->organization->id,
            'invited_user_id' => $this->invitee->id,
            'invited_by_user_id' => $this->admin->id,
            'email' => strtolower($this->invitee->email),
        ]);
    }

    private function respond(string $action, OrganizationInvitation $invitation): TestResponse
    {
        return $this->actingAs($this->invitee, 'sanctum')->postJson("/api/invitations/{$invitation->id}/{$action}");
    }

    private function adminList(): TestResponse
    {
        return $this->actingAs($this->admin, 'sanctum')->getJson("/api/organizations/{$this->organization->id}/invitations");
    }

    // INV-S231
    public function test_the_organization_list_of_a_tenant_keeps_its_item_keys()
    {
        $this->respond('accept', $this->invitation())->assertOk();

        $listed = $this->actingAs($this->invitee, 'sanctum')->getJson('/api/organizations')->assertOk()->json();

        $this->assertSame(['id', 'name', 'ruc', 'email', 'logo', 'status', 'role'], array_keys($listed[0]));
    }

    // INV-S232
    public function test_an_accepted_invitation_shows_on_the_admin_list_and_a_revoke_is_refused()
    {
        $invitation = $this->invitation();
        $this->respond('accept', $invitation)->assertOk();

        $row = collect($this->adminList()->assertOk()->json('data'))->firstWhere('id', $invitation->id);

        $this->assertSame('accepted', $row['status']);
        $this->assertNotNull($row['responded_at']);
        $this->assertFalse($row['can_be_revoked']);
        $this->actingAs($this->admin, 'sanctum')
            ->deleteJson("/api/organizations/{$this->organization->id}/invitations/{$invitation->id}")
            ->assertStatus(409)
            ->assertExactJson(['message' => self::IC12_UNAVAILABLE]);
        $this->assertSame(InvitationStatus::Accepted, $invitation->fresh()->status);
    }

    // INV-S233
    public function test_a_rejected_invitation_shows_on_the_admin_list_as_rejected()
    {
        $invitation = $this->invitation();
        $this->respond('reject', $invitation)->assertOk();

        $row = collect($this->adminList()->assertOk()->json('data'))->firstWhere('id', $invitation->id);

        $this->assertSame('rejected', $row['status']);
        $this->assertNotNull($row['responded_at']);
        $this->assertFalse($row['can_be_revoked']);
    }

    // INV-S234
    public function test_a_response_lowers_the_admin_pending_count_by_one()
    {
        $other = User::factory()->create(['role' => 'tenant', 'state' => 'active']);
        OrganizationInvitation::factory()->create([
            'organization_id' => $this->organization->id,
            'invited_user_id' => $other->id,
            'invited_by_user_id' => $this->admin->id,
            'email' => strtolower($other->email),
        ]);
        $first = $this->invitation();
        $this->assertSame(2, $this->adminList()->json('pending_count'));

        $this->respond('reject', $first)->assertOk();

        $this->assertSame(1, $this->adminList()->json('pending_count'));
    }

    // INV-S235
    public function test_inviting_an_email_that_already_joined_by_accepting_is_refused()
    {
        $this->respond('accept', $this->invitation())->assertOk();

        $this->actingAs($this->admin, 'sanctum')
            ->postJson("/api/organizations/{$this->organization->id}/invitations", ['email' => $this->invitee->email])
            ->assertStatus(422)
            ->assertExactJson([
                'message' => self::IC2_ALREADY_MEMBER,
                'errors' => ['email' => [self::IC2_ALREADY_MEMBER]],
            ]);
    }
}
