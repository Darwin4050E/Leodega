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
 * hue-01 U1a: every domain refusal of POST /organizations/{organization}/invitations
 * (INV-4, INV-5, INV-10). Evaluation order: authorization, email format,
 * inactive organization, then the invitee.
 */
class InviteMemberRefusalTest extends TestCase
{
    use RefreshDatabase;

    private const IC1_GESTOR = 'Solo puedes invitar a clientes; los gestores de bodega no pueden unirse a organizaciones.';

    private const IC2_MEMBER = 'Este usuario ya es miembro de tu organización';

    private const IC3_UNKNOWN = 'No encontramos un cliente con ese correo electrónico.';

    private const IC4_PENDING = 'Ya hay una invitación pendiente para este usuario en tu organización.';

    private const IC5_MISSING = 'Escribe el correo del cliente que quieres invitar.';

    private const IC6_MALFORMED = 'Ingresa un correo válido.';

    private const IC7_INACTIVE = 'La organización seleccionada no está activa.';

    private Organization $organization;

    private User $admin;

    protected function setUp(): void
    {
        parent::setUp();

        Notification::fake();
        Mail::fake();

        $this->admin = $this->user('tenant');
        $this->organization = Organization::factory()->withMember($this->admin, OrganizationRole::ADMIN)->create();
    }

    private function user(string $role = 'tenant', string $state = 'active'): User
    {
        return User::factory()->create(['role' => $role, 'state' => $state]);
    }

    private function invite(string $email, ?User $caller = null, ?Organization $organization = null): TestResponse
    {
        $organization ??= $this->organization;

        return $this->actingAs($caller ?? $this->admin, 'sanctum')
            ->postJson("/api/organizations/{$organization->id}/invitations", ['email' => $email]);
    }

    private function assertRefusal(TestResponse $response, string $message, string $key = 'email'): void
    {
        $response->assertStatus(422)->assertExactJson([
            'message' => $message,
            'errors' => [$key => [$message]],
        ]);
        $this->assertSame(['message', 'errors'], array_keys($response->json()));
    }

    private function assertNothingCreated(int $invitations = 0): void
    {
        $this->assertDatabaseCount('organization_invitations', $invitations);
        $this->assertDatabaseCount('notifications', 0);
        Notification::assertNothingSent();
        Mail::assertNothingSent();
    }

    // INV-S30
    public function test_an_email_without_an_account_is_refused_as_unknown()
    {
        $this->assertRefusal($this->invite('nobody@example.com'), self::IC3_UNKNOWN);
        $this->assertNothingCreated();
    }

    // INV-S31, INV-S32, INV-S33, INV-S86
    public function test_platform_admin_blocked_and_pending_state_accounts_are_byte_identical_to_unknown()
    {
        $unknown = $this->invite('nobody@example.com');

        foreach ([
            $this->user('admin'),
            $this->user('tenant', 'blocked'),
            $this->user('tenant', 'pending'),
        ] as $account) {
            $response = $this->invite($account->email);

            $this->assertRefusal($response, self::IC3_UNKNOWN);
            $this->assertSame($unknown->getContent(), $response->getContent());
        }
        $this->assertNothingCreated();
    }

    // INV-S34
    public function test_an_active_landlord_is_refused_with_the_gestor_message()
    {
        $landlord = $this->user('landlord');

        $this->assertRefusal($this->invite($landlord->email), self::IC1_GESTOR);
        $this->assertNothingCreated();
    }

    // INV-S35: state is evaluated before role
    public function test_a_blocked_landlord_is_refused_as_unknown_not_as_gestor()
    {
        $landlord = $this->user('landlord', 'blocked');

        $this->assertRefusal($this->invite($landlord->email), self::IC3_UNKNOWN);
        $this->assertNothingCreated();
    }

    // INV-S36, INV-S37, INV-S38
    public function test_a_member_another_admin_and_the_caller_are_refused_as_already_members()
    {
        $member = $this->user();
        $otherAdmin = $this->user();
        $this->organization->users()->attach($member->id, ['role' => OrganizationRole::MEMBER->value]);
        $this->organization->users()->attach($otherAdmin->id, ['role' => OrganizationRole::ADMIN->value]);

        foreach ([$member, $otherAdmin, $this->admin] as $account) {
            $this->assertRefusal($this->invite($account->email), self::IC2_MEMBER);
        }
        $this->assertNothingCreated();
    }

    // INV-S39, INV-S58
    public function test_a_non_lapsed_pending_invitation_is_refused_and_left_untouched()
    {
        $invitee = $this->user();
        $existing = OrganizationInvitation::factory()->create([
            'organization_id' => $this->organization->id,
            'invited_user_id' => $invitee->id,
            'invited_by_user_id' => $this->admin->id,
            'email' => strtolower($invitee->email),
        ]);
        $expiresAt = $existing->fresh()->expires_at;
        $otherAdmin = $this->user();
        $this->organization->users()->attach($otherAdmin->id, ['role' => OrganizationRole::ADMIN->value]);

        $this->assertRefusal($this->invite($invitee->email, $otherAdmin), self::IC4_PENDING);

        $this->assertNothingCreated(1);
        $fresh = $existing->fresh();
        $this->assertSame(InvitationStatus::Pending, $fresh->status);
        $this->assertTrue($fresh->expires_at->equalTo($expiresAt));
    }

    // INV-S41
    public function test_already_member_wins_over_a_stale_pending_invitation()
    {
        $member = $this->user();
        $this->organization->users()->attach($member->id, ['role' => OrganizationRole::MEMBER->value]);
        $attributes = [
            'organization_id' => $this->organization->id,
            'invited_user_id' => $member->id,
            'email' => strtolower($member->email),
        ];

        $stale = OrganizationInvitation::factory()->lapsed()->create($attributes);
        $this->assertRefusal($this->invite($member->email), self::IC2_MEMBER);

        $stale->delete();
        OrganizationInvitation::factory()->create($attributes);
        $this->assertRefusal($this->invite($member->email), self::IC2_MEMBER);

        $this->assertDatabaseCount('organization_invitations', 1);
    }

    // INV-S43, INV-S44
    public function test_an_organization_that_is_not_active_refuses_with_the_organization_message()
    {
        $invitee = $this->user();

        foreach (['inactive', 'suspended'] as $status) {
            $this->organization->update(['status' => $status]);

            $this->assertRefusal($this->invite($invitee->email), self::IC7_INACTIVE, 'organization');
        }
        $this->assertNothingCreated();
    }

    // INV-S45
    public function test_an_inactive_organization_wins_over_an_unknown_email()
    {
        $this->organization->update(['status' => 'inactive']);

        $this->assertRefusal($this->invite('nobody@example.com'), self::IC7_INACTIVE, 'organization');
        $this->assertNothingCreated();
    }

    // INV-S46
    public function test_a_malformed_email_wins_over_an_inactive_organization()
    {
        $this->organization->update(['status' => 'inactive']);

        $this->assertRefusal($this->invite('not-an-email'), self::IC6_MALFORMED);
        $this->assertNothingCreated();
    }

    // INV-S87
    public function test_no_refusal_body_contains_the_submitted_email_or_an_account_name()
    {
        $landlord = $this->user('landlord');
        $member = $this->user();
        $this->organization->users()->attach($member->id, ['role' => OrganizationRole::MEMBER->value]);
        $blocked = $this->user('tenant', 'blocked');

        foreach ([$landlord, $member, $blocked] as $account) {
            $response = $this->invite($account->email)->assertStatus(422);
            $body = $response->getContent();

            $this->assertStringNotContainsString($account->email, $body);
            $this->assertStringNotContainsString($account->name, $body);
            $this->assertStringNotContainsString($account->lastname, $body);
        }

        $unknown = $this->invite('nobody@example.com')->assertStatus(422);
        $this->assertStringNotContainsString('nobody@example.com', $unknown->getContent());
    }

    // INV-S91
    public function test_the_set_of_refusal_messages_is_exactly_ic1_to_ic7()
    {
        $landlord = $this->user('landlord');
        $member = $this->user();
        $this->organization->users()->attach($member->id, ['role' => OrganizationRole::MEMBER->value]);
        $pending = $this->user();
        OrganizationInvitation::factory()->create([
            'organization_id' => $this->organization->id,
            'invited_user_id' => $pending->id,
            'email' => strtolower($pending->email),
        ]);
        $inactive = Organization::factory()->inactive()->withMember($this->admin, OrganizationRole::ADMIN)->create();

        $messages = collect([
            $this->invite('')->json('message'),
            $this->invite('not-an-email')->json('message'),
            $this->invite('nobody@example.com')->json('message'),
            $this->invite($landlord->email)->json('message'),
            $this->invite($member->email)->json('message'),
            $this->invite($pending->email)->json('message'),
            $this->invite('nobody@example.com', null, $inactive)->json('message'),
        ])->sort()->values()->all();

        $expected = collect([
            self::IC1_GESTOR, self::IC2_MEMBER, self::IC3_UNKNOWN, self::IC4_PENDING,
            self::IC5_MISSING, self::IC6_MALFORMED, self::IC7_INACTIVE,
        ])->sort()->values()->all();

        $this->assertSame($expected, $messages);
    }

    // INV-S92
    public function test_the_email_is_matched_case_insensitively_for_refusals()
    {
        $landlord = $this->user('landlord');
        $member = $this->user();
        $this->organization->users()->attach($member->id, ['role' => OrganizationRole::MEMBER->value]);

        $this->assertRefusal($this->invite(strtoupper($landlord->email)), self::IC1_GESTOR);
        $this->assertRefusal($this->invite('  '.strtoupper($member->email).'  '), self::IC2_MEMBER);
        $this->assertNothingCreated();
    }
}
