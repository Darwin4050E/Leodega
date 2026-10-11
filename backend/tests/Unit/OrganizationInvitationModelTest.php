<?php

namespace Tests\Unit;

use App\Enums\InvitationStatus;
use App\Models\Organization;
use App\Models\OrganizationInvitation;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * hue-01 U1a: invitation model, effective (lazy) status, pending scope and
 * factory states (INV-1, INV-7, INV-9).
 */
class OrganizationInvitationModelTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        Carbon::setTestNow('2026-10-11 12:00:00');
    }

    protected function tearDown(): void
    {
        Carbon::setTestNow();

        parent::tearDown();
    }

    public function test_the_expiry_window_is_seven_days()
    {
        $this->assertSame(7, OrganizationInvitation::EXPIRY_DAYS);
    }

    public function test_the_status_enum_has_the_five_values()
    {
        $this->assertSame(
            ['pending', 'accepted', 'rejected', 'cancelled', 'expired'],
            array_map(fn (InvitationStatus $status) => $status->value, InvitationStatus::cases())
        );
    }

    // INV-S60 boundary
    public function test_a_pending_invitation_in_the_future_is_effectively_pending()
    {
        $invitation = OrganizationInvitation::factory()->create(['expires_at' => now()->addSecond()]);

        $this->assertSame(InvitationStatus::Pending, $invitation->effective_status);
    }

    public function test_a_pending_invitation_expiring_exactly_now_is_effectively_expired()
    {
        $invitation = OrganizationInvitation::factory()->create(['expires_at' => now()]);

        $this->assertSame(InvitationStatus::Expired, $invitation->effective_status);
    }

    public function test_a_pending_invitation_in_the_past_is_effectively_expired_but_stays_pending_in_the_database()
    {
        $invitation = OrganizationInvitation::factory()->lapsed()->create();

        $this->assertSame(InvitationStatus::Expired, $invitation->effective_status);
        $this->assertSame(InvitationStatus::Pending, $invitation->fresh()->status);
    }

    public function test_other_statuses_are_not_changed_by_the_expiry_date()
    {
        $past = now()->subDay();

        foreach ([
            InvitationStatus::Accepted,
            InvitationStatus::Rejected,
            InvitationStatus::Cancelled,
            InvitationStatus::Expired,
        ] as $status) {
            $invitation = OrganizationInvitation::factory()->create(['status' => $status, 'expires_at' => $past]);

            $this->assertSame($status, $invitation->effective_status);
        }
    }

    public function test_the_pending_scope_keeps_only_pending_rows_that_have_not_lapsed()
    {
        $live = OrganizationInvitation::factory()->create();
        $boundary = OrganizationInvitation::factory()->create(['expires_at' => now()->addSecond()]);
        OrganizationInvitation::factory()->create(['expires_at' => now()]);
        OrganizationInvitation::factory()->lapsed()->create();
        OrganizationInvitation::factory()->accepted()->create();
        OrganizationInvitation::factory()->rejected()->create();
        OrganizationInvitation::factory()->cancelled()->create();
        OrganizationInvitation::factory()->expired()->create();

        $this->assertEqualsCanonicalizing(
            [$live->id, $boundary->id],
            OrganizationInvitation::pending()->pluck('id')->all()
        );
    }

    public function test_relations_resolve_the_organization_invitee_and_inviter()
    {
        $organization = Organization::factory()->create();
        $inviter = User::factory()->create(['role' => 'tenant']);
        $invitation = OrganizationInvitation::factory()->create([
            'organization_id' => $organization->id,
            'invited_by_user_id' => $inviter->id,
        ]);

        $this->assertTrue($invitation->organization->is($organization));
        $this->assertTrue($invitation->inviter->is($inviter));
        $this->assertSame('tenant', $invitation->invitee->role);
        $this->assertTrue($organization->invitations->first()->is($invitation));
    }

    public function test_casts_status_to_the_enum_and_dates_to_carbon()
    {
        $invitation = OrganizationInvitation::factory()->create()->fresh();

        $this->assertInstanceOf(InvitationStatus::class, $invitation->status);
        $this->assertInstanceOf(Carbon::class, $invitation->expires_at);
        $this->assertNull($invitation->responded_at);
    }

    public function test_the_factory_defaults_to_a_pending_invitation_for_a_tenant_valid_for_seven_days()
    {
        $invitation = OrganizationInvitation::factory()->create();

        $this->assertSame(InvitationStatus::Pending, $invitation->status);
        $this->assertSame('tenant', $invitation->invitee->role);
        $this->assertSame(strtolower($invitation->invitee->email), $invitation->email);
        $this->assertTrue($invitation->expires_at->equalTo(now()->addDays(7)));
        $this->assertNull($invitation->invited_by_user_id);
    }

    public function test_the_factory_states_set_the_expected_status()
    {
        $this->assertSame(InvitationStatus::Accepted, OrganizationInvitation::factory()->accepted()->create()->status);
        $this->assertSame(InvitationStatus::Rejected, OrganizationInvitation::factory()->rejected()->create()->status);
        $this->assertSame(InvitationStatus::Cancelled, OrganizationInvitation::factory()->cancelled()->create()->status);
        $this->assertSame(InvitationStatus::Expired, OrganizationInvitation::factory()->expired()->create()->status);

        $lapsed = OrganizationInvitation::factory()->lapsed()->create();
        $this->assertSame(InvitationStatus::Pending, $lapsed->status);
        $this->assertTrue($lapsed->expires_at->isPast());
    }
}
