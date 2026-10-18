<?php

namespace Tests\Feature;

use App\Enums\InvitationStatus;
use App\Enums\OrganizationRole;
use App\Models\Organization;
use App\Models\OrganizationInvitation;
use App\Models\User;
use App\Services\OrganizationInvitationService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Notification;
use Illuminate\Testing\TestResponse;
use ReflectionMethod;
use Tests\TestCase;

/**
 * huc-14 U1b INV-21 on SQLite: the sequential equivalents of the concurrency
 * rows and the lock order, which SQLite cannot show with real locks. The real
 * races are in InvitationRespondConcurrencyTest (PostgreSQL only).
 */
class InvitationRespondOrderingTest extends TestCase
{
    use RefreshDatabase;

    private const IC12_UNAVAILABLE = 'Esta invitación ya no está disponible';

    private const IC80_ALREADY_RESPONDED = 'Ya respondiste esta invitación';

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

    private function invitation(?User $invitee = null, ?Organization $organization = null): OrganizationInvitation
    {
        $invitee ??= $this->invitee;
        $organization ??= $this->organization;

        return OrganizationInvitation::factory()->create([
            'organization_id' => $organization->id,
            'invited_user_id' => $invitee->id,
            'invited_by_user_id' => $this->admin->id,
            'email' => strtolower($invitee->email),
        ]);
    }

    private function respond(string $action, OrganizationInvitation $invitation, ?User $caller = null): TestResponse
    {
        return $this->actingAs($caller ?? $this->invitee, 'sanctum')->postJson("/api/invitations/{$invitation->id}/{$action}");
    }

    private function revoke(OrganizationInvitation $invitation): TestResponse
    {
        return $this->actingAs($this->admin, 'sanctum')
            ->deleteJson("/api/organizations/{$this->organization->id}/invitations/{$invitation->id}");
    }

    private function methodSource(string $method): string
    {
        $reflection = new ReflectionMethod(OrganizationInvitationService::class, $method);
        $lines = file($reflection->getFileName());

        return implode('', array_slice($lines, $reflection->getStartLine() - 1, $reflection->getEndLine() - $reflection->getStartLine() + 1));
    }

    // INV-S219: revoke first
    public function test_an_accept_after_a_revoke_is_409_and_creates_no_membership()
    {
        $invitation = $this->invitation();

        $this->revoke($invitation)->assertOk();
        $this->respond('accept', $invitation)
            ->assertStatus(409)
            ->assertExactJson(['message' => self::IC12_UNAVAILABLE]);

        $this->assertSame(InvitationStatus::Cancelled, $invitation->fresh()->status);
        $this->assertDatabaseMissing('organization_user', ['user_id' => $this->invitee->id]);
    }

    // INV-S219: accept first
    public function test_a_revoke_after_an_accept_is_409_and_the_membership_stands()
    {
        $invitation = $this->invitation();

        $this->respond('accept', $invitation)->assertOk();
        $this->revoke($invitation)
            ->assertStatus(409)
            ->assertExactJson(['message' => self::IC12_UNAVAILABLE]);

        $this->assertSame(InvitationStatus::Accepted, $invitation->fresh()->status);
        $this->assertDatabaseHas('organization_user', ['user_id' => $this->invitee->id, 'organization_id' => $this->organization->id]);
    }

    // INV-S220
    public function test_the_second_accept_is_409_already_responded()
    {
        $invitation = $this->invitation();

        $this->respond('accept', $invitation)->assertOk();
        $this->respond('accept', $invitation)
            ->assertStatus(409)
            ->assertExactJson(['message' => self::IC80_ALREADY_RESPONDED]);

        $this->assertSame(1, $this->organization->users()->whereKey($this->invitee->id)->count());
    }

    // INV-S218 equivalent: accept then reject leaves one terminal state
    public function test_a_reject_after_an_accept_is_409_and_the_acceptance_stands()
    {
        $invitation = $this->invitation();

        $this->respond('accept', $invitation)->assertOk();
        $this->respond('reject', $invitation)
            ->assertStatus(409)
            ->assertExactJson(['message' => self::IC80_ALREADY_RESPONDED]);

        $this->assertSame(InvitationStatus::Accepted, $invitation->fresh()->status);
    }

    // INV-S221: SQLite drops FOR UPDATE, so the order is proven from the source
    public function test_accept_locks_the_invitation_before_the_organization_and_reject_never_locks_the_organization()
    {
        $accept = $this->methodSource('accept');
        $invitationLock = strpos($accept, '$this->lockInvitation(');
        $organizationLock = strpos($accept, '$this->lockOrganization(');

        $this->assertNotFalse($invitationLock, 'accept must lock the invitation.');
        $this->assertNotFalse($organizationLock, 'accept must lock the organization.');
        $this->assertLessThan($organizationLock, $invitationLock);

        $this->assertStringContainsString('$this->lockInvitation(', $this->methodSource('reject'));
        $this->assertStringNotContainsString('lockOrganization', $this->methodSource('reject'));

        $this->assertStringContainsString('lockForUpdate()', $this->methodSource('lockInvitation'));
        $this->assertStringContainsString('lockForUpdate()', $this->methodSource('lockOrganization'));
    }

    // INV-S222
    public function test_a_refused_409_leaves_no_state_behind_for_the_next_valid_accept()
    {
        $cancelled = $this->invitation();
        $this->revoke($cancelled)->assertOk();
        $other = Organization::factory()->withMember($this->admin, OrganizationRole::ADMIN)->create();
        $valid = $this->invitation($this->invitee, $other);

        $this->respond('accept', $cancelled)->assertStatus(409);
        $this->respond('accept', $valid)->assertOk();

        $this->assertSame(InvitationStatus::Accepted, $valid->fresh()->status);
        $this->assertDatabaseHas('organization_user', ['user_id' => $this->invitee->id, 'organization_id' => $other->id]);
        $this->assertDatabaseMissing('organization_user', ['user_id' => $this->invitee->id, 'organization_id' => $this->organization->id]);
    }
}
