<?php

namespace Tests\Feature;

use App\Enums\OrganizationRole;
use App\Models\Organization;
use App\Models\OrganizationInvitation;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Testing\TestResponse;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

/**
 * hue-01 U1a: authorization matrix of the invite (POST) and list (GET)
 * endpoints (INV-2). Path based, `org.context` is not mounted, so the
 * X-Organization-Id header plays no role. The DELETE rows are in RevokeInvitationTest.
 */
class InviteMemberAuthorizationTest extends TestCase
{
    use RefreshDatabase;

    private const NOT_MEMBER = 'No perteneces a la organización seleccionada';

    private const FORBIDDEN_ROLE = 'No autorizado';

    private Organization $organization;

    private User $admin;

    protected function setUp(): void
    {
        parent::setUp();

        $this->admin = $this->tenant();
        $this->organization = Organization::factory()->withMember($this->admin, OrganizationRole::ADMIN)->create();
    }

    private function tenant(string $role = 'tenant'): User
    {
        return User::factory()->create(['role' => $role]);
    }

    private function url(Organization|int|string|null $organization = null): string
    {
        $organization ??= $this->organization;
        $id = $organization instanceof Organization ? $organization->id : $organization;

        return "/api/organizations/{$id}/invitations";
    }

    private function send(string $method, ?User $caller, Organization|int|string|null $organization = null, ?array $body = null, array $headers = []): TestResponse
    {
        $request = $caller ? $this->actingAs($caller, 'sanctum') : $this;
        $body ??= $method === 'POST' ? ['email' => 'invitee@example.com'] : [];

        return $request->json($method, $this->url($organization), $body, $headers);
    }

    public static function methods(): array
    {
        return ['POST' => ['POST'], 'GET' => ['GET']];
    }

    // INV-S9
    #[DataProvider('methods')]
    public function test_a_request_without_a_token_is_401(string $method)
    {
        $this->send($method, null)
            ->assertStatus(401)
            ->assertExactJson(['message' => 'Unauthenticated.']);
    }

    // INV-S10
    #[DataProvider('methods')]
    public function test_a_landlord_is_403_with_the_role_message_and_nothing_is_written(string $method)
    {
        $this->send($method, $this->tenant('landlord'))
            ->assertStatus(403)
            ->assertExactJson(['message' => self::FORBIDDEN_ROLE]);

        $this->assertDatabaseCount('organization_invitations', 0);
    }

    // INV-S11
    #[DataProvider('methods')]
    public function test_a_platform_admin_is_403_with_the_role_message(string $method)
    {
        $this->send($method, $this->tenant('admin'))
            ->assertStatus(403)
            ->assertExactJson(['message' => self::FORBIDDEN_ROLE]);

        $this->assertDatabaseCount('organization_invitations', 0);
    }

    // INV-S12, INV-S19
    #[DataProvider('methods')]
    public function test_a_non_member_and_a_nonexistent_organization_get_the_identical_403(string $method)
    {
        $outsider = $this->tenant();
        $otherAdmin = $this->tenant();
        Organization::factory()->withMember($otherAdmin, OrganizationRole::ADMIN)->create();

        $nonMember = $this->send($method, $outsider);
        $nonexistent = $this->send($method, $outsider, 987654);
        $adminOfAnotherOrg = $this->send($method, $otherAdmin);

        foreach ([$nonMember, $nonexistent, $adminOfAnotherOrg] as $response) {
            $response->assertStatus(403)->assertExactJson(['message' => self::NOT_MEMBER]);
        }
        $this->assertSame($nonMember->getContent(), $nonexistent->getContent());
        $this->assertDatabaseCount('organization_invitations', 0);
    }

    // INV-S13
    #[DataProvider('methods')]
    public function test_a_member_is_403_with_the_role_message_and_nothing_is_written(string $method)
    {
        $member = $this->tenant();
        $this->organization->users()->attach($member->id, ['role' => OrganizationRole::MEMBER->value]);

        $this->send($method, $member)
            ->assertStatus(403)
            ->assertExactJson(['message' => self::FORBIDDEN_ROLE]);

        $this->assertDatabaseCount('organization_invitations', 0);
    }

    // INV-S15
    public function test_a_member_posting_an_empty_body_gets_403_not_422()
    {
        $member = $this->tenant();
        $this->organization->users()->attach($member->id, ['role' => OrganizationRole::MEMBER->value]);

        $this->send('POST', $member, null, [])
            ->assertStatus(403)
            ->assertExactJson(['message' => self::FORBIDDEN_ROLE]);
    }

    // INV-S16
    public function test_a_non_member_posting_an_invalid_email_gets_403_not_422()
    {
        $this->send('POST', $this->tenant(), null, ['email' => 'not-an-email'])
            ->assertStatus(403)
            ->assertExactJson(['message' => self::NOT_MEMBER]);
    }

    // INV-S17
    public function test_the_active_organization_header_plays_no_role()
    {
        $other = Organization::factory()->withMember($this->admin, OrganizationRole::ADMIN)->create();
        $member = $this->tenant();
        $this->organization->users()->attach($member->id, ['role' => OrganizationRole::MEMBER->value]);

        $baseline = $this->send('GET', $this->admin);
        $baseline->assertOk();

        foreach ([(string) $other->id, 'abc', ''] as $header) {
            $response = $this->send('GET', $this->admin, null, null, ['X-Organization-Id' => $header]);
            $response->assertOk();
        }

        $this->send('GET', $member, null, null, ['X-Organization-Id' => (string) $this->organization->id])
            ->assertStatus(403)
            ->assertExactJson(['message' => self::FORBIDDEN_ROLE]);
    }

    // INV-S20
    #[DataProvider('methods')]
    public function test_an_organization_id_outside_the_pattern_is_404(string $method)
    {
        foreach (['0', 'abc', '1234567890123456789'] as $id) {
            $this->send($method, $this->admin, $id)->assertNotFound();
        }

        // A well-formed id for the same caller does reach the controller.
        $this->assertNotSame(404, $this->send('GET', $this->admin)->status());
    }

    // INV-S21
    #[DataProvider('methods')]
    public function test_every_403_body_has_only_the_message_key(string $method)
    {
        $member = $this->tenant();
        $this->organization->users()->attach($member->id, ['role' => OrganizationRole::MEMBER->value]);

        foreach ([$this->tenant('landlord'), $this->tenant('admin'), $this->tenant(), $member] as $caller) {
            $response = $this->send($method, $caller);

            $response->assertStatus(403);
            $this->assertSame(['message'], array_keys($response->json()));
        }
    }

    // INV-S18
    public function test_a_demoted_admin_is_403_at_once()
    {
        $second = $this->tenant();
        $this->organization->users()->attach($second->id, ['role' => OrganizationRole::ADMIN->value]);

        $this->send('GET', $second)->assertOk();

        $this->organization->users()->updateExistingPivot($second->id, ['role' => OrganizationRole::MEMBER->value]);

        foreach (['GET', 'POST'] as $method) {
            $this->send($method, $second)->assertStatus(403)->assertExactJson(['message' => self::FORBIDDEN_ROLE]);
        }
        $this->assertSame(0, OrganizationInvitation::count());
    }
}
