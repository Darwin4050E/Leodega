<?php

namespace Tests\Feature;

use App\Enums\OrganizationRole;
use App\Http\Middleware\ResolveActiveOrganization;
use App\Models\Organization;
use App\Models\User;
use App\Support\ActiveContext;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

/**
 * HUE-02 U1: the `org.context` middleware resolves the active organization
 * from X-Organization-Id. Resolution cases go through probe routes
 * registered here only; HUE-05 (AC-24) mounts it on exactly two production
 * routes, checked by the allow-list test below and by
 * AC-25's header-403 integration test on the real routes.
 */
class ActiveOrganizationContextTest extends TestCase
{
    use RefreshDatabase;

    private const PROBE = '/api/_probe/active-context';

    private const OPEN_PROBE = '/api/_probe/active-context-open';

    private int $probeCalls = 0;

    protected function setUp(): void
    {
        parent::setUp();

        $echo = function (Request $request) {
            $this->probeCalls++;
            $context = ActiveContext::fromRequest($request);

            return response()->json([
                'organization_id' => $context->organization?->id,
                'role' => $context->role?->value,
            ]);
        };

        Route::middleware(['auth.api:sanctum', 'role:tenant', 'org.context'])->get(self::PROBE, $echo);
        // Role-agnostic mount: proves the middleware itself never checks the role.
        Route::middleware(['auth.api:sanctum', 'org.context'])->get(self::OPEN_PROBE, $echo);
    }

    private function tenant(): User
    {
        return User::factory()->create(['role' => 'tenant']);
    }

    private function organizationFor(User $user, OrganizationRole $role = OrganizationRole::ADMIN): Organization
    {
        return Organization::factory()->withMember($user, $role)->create();
    }

    private function probe(?User $user, array $headers = [], string $uri = self::PROBE): \Illuminate\Testing\TestResponse
    {
        $request = $user ? $this->actingAs($user, 'sanctum') : $this;

        return $request->getJson($uri, $headers);
    }

    public function test_a_tenant_without_the_header_stays_personal()
    {
        $response = $this->probe($this->tenant());

        $response->assertOk();
        $response->assertExactJson(['organization_id' => null, 'role' => null]);
    }

    public function test_an_empty_header_stays_personal()
    {
        $response = $this->probe($this->tenant(), ['X-Organization-Id' => '']);

        $response->assertOk();
        $response->assertExactJson(['organization_id' => null, 'role' => null]);
    }

    public function test_a_whitespace_only_header_stays_personal()
    {
        $response = $this->probe($this->tenant(), ['X-Organization-Id' => '   ']);

        $response->assertOk();
        $response->assertExactJson(['organization_id' => null, 'role' => null]);
    }

    public function test_an_admin_member_resolves_the_organization_with_the_admin_role()
    {
        $user = $this->tenant();
        $organization = $this->organizationFor($user, OrganizationRole::ADMIN);

        $response = $this->probe($user, ['X-Organization-Id' => (string) $organization->id]);

        $response->assertOk();
        $response->assertExactJson(['organization_id' => $organization->id, 'role' => 'admin']);
    }

    public function test_a_plain_member_resolves_the_organization_with_the_member_role()
    {
        $user = $this->tenant();
        $organization = $this->organizationFor($user, OrganizationRole::MEMBER);

        $response = $this->probe($user, ['X-Organization-Id' => (string) $organization->id]);

        $response->assertOk();
        $response->assertExactJson(['organization_id' => $organization->id, 'role' => 'member']);
    }

    public function test_the_role_is_the_callers_own_pivot_role_not_another_members()
    {
        $admin = $this->tenant();
        $member = $this->tenant();
        $organization = Organization::factory()
            ->withMember($admin, OrganizationRole::ADMIN)
            ->withMember($member, OrganizationRole::MEMBER)
            ->create();

        $response = $this->probe($member, ['X-Organization-Id' => (string) $organization->id]);

        $response->assertOk();
        $response->assertExactJson(['organization_id' => $organization->id, 'role' => 'member']);
    }

    public function test_the_header_picks_the_requested_organization_among_several()
    {
        $user = $this->tenant();
        $first = $this->organizationFor($user, OrganizationRole::ADMIN);
        $second = $this->organizationFor($user, OrganizationRole::MEMBER);

        $response = $this->probe($user, ['X-Organization-Id' => (string) $second->id]);

        $response->assertExactJson(['organization_id' => $second->id, 'role' => 'member']);
        $this->assertNotSame($first->id, $second->id);
    }

    public function test_a_header_padded_with_spaces_still_resolves()
    {
        $user = $this->tenant();
        $organization = $this->organizationFor($user);

        $response = $this->probe($user, ['X-Organization-Id' => ' '.$organization->id.' ']);

        $response->assertOk();
        $response->assertExactJson(['organization_id' => $organization->id, 'role' => 'admin']);
    }

    public function test_the_header_name_is_case_insensitive()
    {
        $user = $this->tenant();
        $organization = $this->organizationFor($user);

        $response = $this->probe($user, ['x-organization-id' => (string) $organization->id]);

        $response->assertOk();
        $response->assertExactJson(['organization_id' => $organization->id, 'role' => 'admin']);
    }

    private function assertHeaderForbidden(\Illuminate\Testing\TestResponse $response): void
    {
        $response->assertForbidden();
        $response->assertExactJson(['message' => ResolveActiveOrganization::FORBIDDEN_MESSAGE]);
        $response->assertJsonMissingPath('status');
        $this->assertNotSame('No autorizado', $response->json('message'));
        $this->assertSame(0, $this->probeCalls);
    }

    public function test_an_existing_organization_the_caller_does_not_belong_to_is_forbidden()
    {
        $foreign = $this->organizationFor($this->tenant());

        $response = $this->probe($this->tenant(), ['X-Organization-Id' => (string) $foreign->id]);

        $this->assertHeaderForbidden($response);
    }

    public function test_a_nonexistent_organization_gets_the_byte_identical_forbidden_body()
    {
        $user = $this->tenant();
        $foreign = $this->organizationFor($this->tenant());

        $foreignResponse = $this->probe($user, ['X-Organization-Id' => (string) $foreign->id]);
        $missingResponse = $this->probe($user, ['X-Organization-Id' => '999999']);

        $this->assertHeaderForbidden($missingResponse);
        $this->assertSame($foreignResponse->getContent(), $missingResponse->getContent());
    }

    public static function malformedHeaderValues(): array
    {
        return [
            'letters' => ['abc'],
            'zero' => ['0'],
            'negative' => ['-1'],
            'decimal' => ['1.5'],
            'exponent' => ['1e2'],
            'explicit plus sign' => ['+1'],
            'leading zero' => ['01'],
            'hexadecimal' => ['0x1'],
            'comma joined' => ['1,2'],
            'comma and space' => ['1, 2'],
            'array literal' => ['[1]'],
            'arabic-indic digit' => ["\u{0661}"],
            'inner whitespace' => ['1 2'],
            'overflow' => ['99999999999999999999'],
            'one past the 64-bit maximum' => ['9223372036854775808'],
        ];
    }

    #[DataProvider('malformedHeaderValues')]
    public function test_a_malformed_header_is_forbidden_even_for_a_member_of_org_one(string $value)
    {
        $user = $this->tenant();
        $organization = $this->organizationFor($user);
        $this->assertSame(1, $organization->id, 'Malformed values must be discriminated against a real org 1.');

        $response = $this->probe($user, ['X-Organization-Id' => $value]);

        $this->assertHeaderForbidden($response);
    }

    public function test_the_64_bit_maximum_is_well_formed_and_is_forbidden_not_a_server_error()
    {
        $user = $this->tenant();
        $this->organizationFor($user);

        $response = $this->probe($user, ['X-Organization-Id' => '9223372036854775807']);

        $this->assertHeaderForbidden($response);
    }

    public function test_the_64_bit_guard_discriminates_against_an_organization_holding_the_maximum_id()
    {
        $user = $this->tenant();
        $organization = Organization::factory()->withMember($user)->create(['id' => PHP_INT_MAX]);

        $maximum = $this->probe($user, ['X-Organization-Id' => '9223372036854775807']);
        $maximum->assertOk();
        $maximum->assertExactJson(['organization_id' => $organization->id, 'role' => 'admin']);

        // A saturating (int) cast would map both of these to the real org above.
        foreach (['9223372036854775808', '99999999999999999999'] as $overflow) {
            $this->probeCalls = 0;

            $this->assertHeaderForbidden($this->probe($user, ['X-Organization-Id' => $overflow]));
        }
    }

    public function test_the_role_gate_wins_over_the_header_for_a_landlord()
    {
        $landlord = User::factory()->create(['role' => 'landlord']);
        $organization = $this->organizationFor($this->tenant());

        foreach ([[], ['X-Organization-Id' => (string) $organization->id], ['X-Organization-Id' => 'abc']] as $headers) {
            $response = $this->probe($landlord, $headers);

            $response->assertForbidden();
            $response->assertExactJson(['message' => 'No autorizado']);
        }

        $this->assertSame(0, $this->probeCalls);
    }

    public function test_a_landlord_on_a_role_agnostic_route_is_personal_without_the_header()
    {
        $response = $this->probe(User::factory()->create(['role' => 'landlord']), [], self::OPEN_PROBE);

        $response->assertOk();
        $response->assertExactJson(['organization_id' => null, 'role' => null]);
    }

    public function test_a_landlord_on_a_role_agnostic_route_gets_the_header_message_for_a_valid_looking_id()
    {
        $organization = $this->organizationFor($this->tenant());

        $response = $this->probe(
            User::factory()->create(['role' => 'landlord']),
            ['X-Organization-Id' => (string) $organization->id],
            self::OPEN_PROBE,
        );

        $this->assertHeaderForbidden($response);
    }

    public function test_without_a_token_the_response_is_unauthenticated_with_or_without_the_header()
    {
        foreach ([[], ['X-Organization-Id' => '1']] as $headers) {
            $response = $this->probe(null, $headers);

            $response->assertUnauthorized();
            $response->assertExactJson(['message' => 'Unauthenticated.']);
            $response->assertJsonMissingPath('status');
        }

        $this->assertSame(0, $this->probeCalls);
    }

    public function test_membership_is_checked_on_every_request_and_never_cached()
    {
        $user = $this->tenant();
        $organization = $this->organizationFor($user);
        $headers = ['X-Organization-Id' => (string) $organization->id];

        $this->probe($user, $headers)->assertOk();

        $organization->users()->detach($user->id);
        $this->probeCalls = 0;

        $this->assertHeaderForbidden($this->probe($user, $headers));
    }

    /**
     * HUE-05 AC-24/AC-S19: `org.context` is now mounted on exactly two
     * production routes (reservation store + tenant list). Any other route
     * carrying it -- including a stale header 403'ing an unrelated action
     * like cancel/pay/receipt -- is a regression (see design: per-route
     * mount, never per-group).
     */
    public function test_org_context_is_mounted_on_exactly_the_allow_listed_production_routes()
    {
        $mounted = collect(Route::getRoutes()->getRoutes())
            ->reject(fn ($route) => str_starts_with($route->uri(), 'api/_probe/'))
            ->filter(fn ($route) => in_array('org.context', $route->gatherMiddleware(), true))
            ->map(fn ($route) => collect($route->methods())
                ->reject(fn ($method) => $method === 'HEAD')
                ->map(fn ($method) => $method.' '.$route->uri())
                ->all())
            ->flatten()
            ->sort()
            ->values()
            ->all();

        $this->assertSame(['GET api/tenant/reservations', 'POST api/reservations'], $mounted);
    }

    public function test_the_alias_maps_to_the_middleware_class()
    {
        $this->assertSame(
            ResolveActiveOrganization::class,
            app('router')->getMiddleware()['org.context'] ?? null,
        );
    }

    public function test_the_probe_routes_exist_only_in_the_test_process()
    {
        foreach (['routes/api.php', 'routes/web.php'] as $file) {
            $this->assertStringNotContainsString('_probe', file_get_contents(base_path($file)), $file);
        }
    }

    public function test_a_cors_preflight_may_ask_for_the_header_without_any_config_change()
    {
        $response = $this->call('OPTIONS', '/api/organizations', [], [], [], [
            'HTTP_ORIGIN' => config('cors.allowed_origins')[0],
            'HTTP_ACCESS_CONTROL_REQUEST_METHOD' => 'GET',
            'HTTP_ACCESS_CONTROL_REQUEST_HEADERS' => 'x-organization-id',
        ]);

        $this->assertLessThan(300, $response->getStatusCode());
        $this->assertStringContainsString(
            'x-organization-id',
            strtolower((string) $response->headers->get('Access-Control-Allow-Headers')),
        );
    }
}
