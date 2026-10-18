<?php

namespace Tests\Feature;

use App\Enums\OrganizationRole;
use App\Models\Organization;
use App\Models\OrganizationInvitation;
use App\Models\User;
use App\Services\OrganizationPanelService;
use App\Services\SpendingLimitService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Testing\TestResponse;
use PHPUnit\Framework\Attributes\DataProvider;
use RuntimeException;
use Tests\TestCase;

/**
 * hue-03 U1a: access rules of the organization panel endpoints (PAN-1, PAN-2,
 * PAN-17). Path based, `org.context` is not mounted, so the X-Organization-Id
 * header plays no role and membership comes from the organization_user pivot.
 */
class OrganizationPanelAuthorizationTest extends TestCase
{
    use RefreshDatabase;

    private const NOT_MEMBER = 'No perteneces a la organización seleccionada';

    private Organization $organization;

    private User $admin;

    private User $member;

    protected function setUp(): void
    {
        parent::setUp();

        $this->admin = $this->tenant();
        $this->member = $this->tenant();
        $this->organization = Organization::factory()
            ->withMember($this->admin, OrganizationRole::ADMIN)
            ->withMember($this->member, OrganizationRole::MEMBER)
            ->create();
    }

    private function tenant(): User
    {
        return User::factory()->create(['role' => 'tenant']);
    }

    public static function endpoints(): array
    {
        return ['summary' => ['summary'], 'members' => ['members']];
    }

    private function hit(?User $caller, string $endpoint, Organization|int|string|null $organization = null, array $headers = [], string $method = 'GET'): TestResponse
    {
        $id = $organization instanceof Organization ? $organization->id : ($organization ?? $this->organization->id);
        $request = $caller ? $this->actingAs($caller, 'sanctum') : $this;

        return $request->json($method, "/api/organizations/{$id}/panel/{$endpoint}", [], $headers);
    }

    #[DataProvider('endpoints')]
    public function test_an_admin_and_a_member_both_get_200(string $endpoint)
    {
        $this->hit($this->admin, $endpoint)->assertOk();
        $this->hit($this->member, $endpoint)->assertOk();
    }

    #[DataProvider('endpoints')]
    public function test_unauthenticated_requests_get_401(string $endpoint)
    {
        $this->hit(null, $endpoint)->assertStatus(401);
    }

    #[DataProvider('endpoints')]
    public function test_a_landlord_is_refused_by_the_tenant_role_gate(string $endpoint)
    {
        $landlord = User::factory()->create(['role' => 'landlord']);

        $this->hit($landlord, $endpoint)->assertStatus(403);
    }

    #[DataProvider('endpoints')]
    public function test_a_non_member_and_a_nonexistent_organization_get_the_identical_403(string $endpoint)
    {
        $outsider = $this->tenant();
        Organization::factory()->withMember($outsider, OrganizationRole::ADMIN)->create();

        $foreign = $this->hit($outsider, $endpoint);
        $missing = $this->hit($outsider, $endpoint, 99999);

        $foreign->assertStatus(403)->assertExactJson(['message' => self::NOT_MEMBER]);
        $this->assertSame($foreign->getContent(), $missing->getContent());
        $this->assertSame(403, $missing->status());
    }

    #[DataProvider('endpoints')]
    public function test_a_tenant_with_no_organizations_gets_403_not_member(string $endpoint)
    {
        $this->hit($this->tenant(), $endpoint)
            ->assertStatus(403)
            ->assertExactJson(['message' => self::NOT_MEMBER]);
    }

    #[DataProvider('endpoints')]
    public function test_an_invitee_who_never_accepted_is_not_a_member(string $endpoint)
    {
        foreach (['pending', 'rejected', 'expired', 'cancelled', 'lapsed'] as $state) {
            $invitee = $this->tenant();
            $factory = OrganizationInvitation::factory();
            $factory = $state === 'pending' ? $factory : $factory->{$state}();
            $factory->create([
                'organization_id' => $this->organization->id,
                'invited_user_id' => $invitee->id,
                'email' => strtolower($invitee->email),
            ]);

            $this->hit($invitee, $endpoint)
                ->assertStatus(403)
                ->assertExactJson(['message' => self::NOT_MEMBER]);
        }
    }

    #[DataProvider('endpoints')]
    public function test_the_organization_header_is_ignored(string $endpoint)
    {
        $other = Organization::factory()->withMember($this->admin, OrganizationRole::ADMIN)->create();
        $outsiderOrg = Organization::factory()->create();

        $this->hit($this->admin, $endpoint, $this->organization, ['X-Organization-Id' => (string) $outsiderOrg->id])->assertOk();

        $response = $this->hit($this->admin, $endpoint, $other, ['X-Organization-Id' => (string) $this->organization->id])->assertOk();

        if ($endpoint === 'summary') {
            $response->assertJsonPath('organization_id', $other->id);
        }
    }

    public static function malformedIds(): array
    {
        $cases = [];
        foreach (['summary', 'members'] as $endpoint) {
            foreach (['abc', '0', '007', '1234567890123456789'] as $id) {
                $cases["{$endpoint} {$id}"] = [$endpoint, $id];
            }
        }

        return $cases;
    }

    #[DataProvider('malformedIds')]
    public function test_a_malformed_organization_id_is_404(string $endpoint, string $id)
    {
        $this->hit($this->admin, $endpoint, $id)->assertStatus(404);
    }

    #[DataProvider('endpoints')]
    public function test_a_403_body_carries_only_the_message(string $endpoint)
    {
        $response = $this->hit($this->tenant(), $endpoint)->assertStatus(403);

        $this->assertSame(['message'], array_keys($response->json()));
    }

    public static function writeMethods(): array
    {
        $cases = [];
        foreach (['summary', 'members'] as $endpoint) {
            foreach (['POST', 'PUT', 'PATCH', 'DELETE'] as $method) {
                $cases["{$method} {$endpoint}"] = [$endpoint, $method];
            }
        }

        return $cases;
    }

    #[DataProvider('writeMethods')]
    public function test_write_verbs_are_405(string $endpoint, string $method)
    {
        $this->hit($this->admin, $endpoint, null, [], $method)->assertStatus(405);
    }

    #[DataProvider('endpoints')]
    public function test_an_unexpected_failure_is_a_generic_500_without_internals(string $endpoint)
    {
        config(['app.debug' => false]);
        $this->app->bind(OrganizationPanelService::class, fn () => new class(new SpendingLimitService) extends OrganizationPanelService
        {
            public function summary(Organization $organization, User $caller, bool $isAdmin): array
            {
                throw new RuntimeException('SELECT secret FROM somewhere');
            }

            public function members(Organization $organization, User $caller, bool $isAdmin): array
            {
                throw new RuntimeException('SELECT secret FROM somewhere');
            }
        });

        $response = $this->hit($this->admin, $endpoint)->assertStatus(500);

        $this->assertStringNotContainsString('SELECT', $response->getContent());
        $this->assertStringNotContainsString('RuntimeException', $response->getContent());
        $this->assertStringNotContainsString('trace', $response->getContent());
    }
}
