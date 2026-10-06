<?php

namespace Tests\Unit;

use App\Enums\OrganizationRole;
use App\Http\Middleware\ResolveActiveOrganization;
use App\Models\Organization;
use App\Models\User;
use App\Support\ActiveContext;
use Illuminate\Http\Request;
use LogicException;
use Symfony\Component\HttpFoundation\Response;
use Tests\TestCase;

/**
 * HUE-02 U1: the ActiveContext accessor (part A) and the org.context
 * middleware exercised directly on a Request, without the router (part B).
 */
class ResolveActiveOrganizationTest extends TestCase
{
    public function test_personal_context_has_no_organization_and_no_role()
    {
        $context = ActiveContext::personal();

        $this->assertTrue($context->isPersonal());
        $this->assertFalse($context->isOrganization());
        $this->assertNull($context->organization);
        $this->assertNull($context->role);
    }

    public function test_organization_context_carries_the_organization_and_role()
    {
        $organization = new Organization(['name' => 'Importadora Andina S.A.']);

        $admin = ActiveContext::organization($organization, OrganizationRole::ADMIN);
        $member = ActiveContext::organization($organization, OrganizationRole::MEMBER);

        $this->assertTrue($admin->isOrganization());
        $this->assertFalse($admin->isPersonal());
        $this->assertSame($organization, $admin->organization);
        $this->assertSame(OrganizationRole::ADMIN, $admin->role);
        $this->assertSame(OrganizationRole::MEMBER, $member->role);
    }

    public function test_from_request_throws_when_the_middleware_did_not_run()
    {
        $this->expectException(LogicException::class);

        ActiveContext::fromRequest(Request::create('/api/anything'));
    }

    public function test_from_request_is_personal_when_both_attributes_are_present_and_null()
    {
        $request = Request::create('/api/anything');
        $request->attributes->set('active_organization', null);
        $request->attributes->set('active_organization_role', null);

        $context = ActiveContext::fromRequest($request);

        $this->assertTrue($context->isPersonal());
        $this->assertNull($context->organization);
        $this->assertNull($context->role);
    }

    public function test_from_request_reads_the_organization_and_role_attributes()
    {
        $organization = new Organization(['name' => 'Importadora Andina S.A.']);
        $request = Request::create('/api/anything');
        $request->attributes->set('active_organization', $organization);
        $request->attributes->set('active_organization_role', OrganizationRole::MEMBER);

        $context = ActiveContext::fromRequest($request);

        $this->assertTrue($context->isOrganization());
        $this->assertSame($organization, $context->organization);
        $this->assertSame(OrganizationRole::MEMBER, $context->role);
    }

    private function handle(Request $request): Response
    {
        return (new ResolveActiveOrganization)->handle($request, fn () => response()->json(['ok' => true]));
    }

    public function test_a_header_carrying_two_values_is_forbidden_even_when_the_first_is_a_membership()
    {
        $user = User::factory()->make(['role' => 'tenant']);
        $request = Request::create('/api/anything');
        $request->setUserResolver(fn () => $user);
        $request->headers->set(ResolveActiveOrganization::HEADER, ['1', '2']);
        $nextCalls = 0;

        $response = (new ResolveActiveOrganization)->handle($request, function () use (&$nextCalls) {
            $nextCalls++;

            return response()->json(['ok' => true]);
        });

        $this->assertSame(403, $response->getStatusCode());
        $this->assertSame(
            ['message' => ResolveActiveOrganization::FORBIDDEN_MESSAGE],
            json_decode($response->getContent(), true),
        );
        $this->assertSame(0, $nextCalls);
    }

    public function test_a_request_without_a_user_is_unauthenticated_regardless_of_the_header()
    {
        $request = Request::create('/api/anything');
        $request->headers->set(ResolveActiveOrganization::HEADER, '1');

        $response = $this->handle($request);

        $this->assertSame(401, $response->getStatusCode());
        $this->assertSame(['message' => 'Unauthenticated.'], json_decode($response->getContent(), true));
    }

    public function test_without_a_header_both_attributes_are_set_to_null_and_next_receives_the_same_request_once()
    {
        $user = User::factory()->make(['role' => 'tenant']);
        $request = Request::create('/api/anything');
        $request->setUserResolver(fn () => $user);
        $received = [];

        $response = (new ResolveActiveOrganization)->handle($request, function (Request $passed) use (&$received) {
            $received[] = $passed;

            return response()->json(['ok' => true]);
        });

        $this->assertSame(200, $response->getStatusCode());
        $this->assertCount(1, $received);
        $this->assertSame($request, $received[0]);
        $this->assertTrue($request->attributes->has('active_organization'));
        $this->assertTrue($request->attributes->has('active_organization_role'));
        $this->assertNull($request->attributes->get('active_organization'));
        $this->assertNull($request->attributes->get('active_organization_role'));
    }
}
