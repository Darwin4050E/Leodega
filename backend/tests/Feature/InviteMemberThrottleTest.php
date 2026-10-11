<?php

namespace Tests\Feature;

use App\Enums\OrganizationRole;
use App\Models\Organization;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Facades\Route;
use Illuminate\Testing\TestResponse;
use Tests\TestCase;

/**
 * hue-01 U1a: the 10 per minute per inviter limit on POST invitations (INV-8).
 * Every POST counts, whatever its outcome. The DELETE half of INV-S70 runs
 * with the revoke route in U1b.
 */
class InviteMemberThrottleTest extends TestCase
{
    use RefreshDatabase;

    private const IC11_THROTTLED = 'Enviaste demasiadas invitaciones. Intenta de nuevo en un minuto.';

    private Organization $organization;

    private User $admin;

    protected function setUp(): void
    {
        parent::setUp();

        Notification::fake();
        Mail::fake();

        $this->admin = $this->tenant();
        $this->organization = Organization::factory()->withMember($this->admin, OrganizationRole::ADMIN)->create();
    }

    private function tenant(): User
    {
        return User::factory()->create(['role' => 'tenant', 'state' => 'active']);
    }

    private function invite(string $email, ?User $caller = null, ?Organization $organization = null): TestResponse
    {
        $organization ??= $this->organization;

        return $this->actingAs($caller ?? $this->admin, 'sanctum')
            ->postJson("/api/organizations/{$organization->id}/invitations", ['email' => $email]);
    }

    private function inviteNewTenants(int $count, ?User $caller = null, ?Organization $organization = null): void
    {
        for ($i = 0; $i < $count; $i++) {
            $this->invite($this->tenant()->email, $caller, $organization)->assertCreated();
        }
    }

    // INV-S64
    public function test_ten_valid_invitations_in_a_minute_all_succeed()
    {
        $this->inviteNewTenants(10);

        $this->assertDatabaseCount('organization_invitations', 10);
    }

    // INV-S65
    public function test_the_eleventh_invitation_is_throttled_with_the_ic11_body_and_retry_after()
    {
        $this->inviteNewTenants(10);

        $response = $this->invite($this->tenant()->email)->assertStatus(429);

        $response->assertExactJson(['message' => self::IC11_THROTTLED]);
        $this->assertSame(['message'], array_keys($response->json()));
        $this->assertNotNull($response->headers->get('Retry-After'));
        $this->assertDatabaseCount('organization_invitations', 10);
        $this->assertDatabaseCount('notifications', 0);
        Notification::assertNothingSent();
        Mail::assertNothingSent();
    }

    // INV-S66
    public function test_refused_attempts_count_toward_the_limit()
    {
        for ($i = 0; $i < 10; $i++) {
            $this->invite('nobody'.$i.'@example.com')->assertUnprocessable();
        }

        $this->invite($this->tenant()->email)->assertStatus(429);
    }

    // INV-S67
    public function test_the_limit_is_per_inviter()
    {
        $other = $this->tenant();
        $this->organization->users()->attach($other->id, ['role' => OrganizationRole::ADMIN->value]);
        $this->inviteNewTenants(10);

        $this->invite($this->tenant()->email)->assertStatus(429);
        $this->invite($this->tenant()->email, $other)->assertCreated();
    }

    // INV-S68
    public function test_the_count_is_shared_across_the_inviters_organizations()
    {
        $second = Organization::factory()->withMember($this->admin, OrganizationRole::ADMIN)->create();
        $this->inviteNewTenants(6);
        $this->inviteNewTenants(4, null, $second);

        $this->invite($this->tenant()->email)->assertStatus(429);
        $this->invite($this->tenant()->email, null, $second)->assertStatus(429);
    }

    // INV-S69
    public function test_invitations_are_accepted_again_after_the_window()
    {
        $this->inviteNewTenants(10);
        $this->invite($this->tenant()->email)->assertStatus(429);

        $this->travel(61)->seconds();

        $this->invite($this->tenant()->email)->assertCreated();
    }

    // INV-S70 (GET half)
    public function test_listing_is_not_limited()
    {
        for ($i = 0; $i < 15; $i++) {
            $this->actingAs($this->admin, 'sanctum')
                ->getJson("/api/organizations/{$this->organization->id}/invitations")
                ->assertOk();
        }
    }

    // INV-S71
    public function test_the_post_route_names_a_registered_limiter()
    {
        $route = Route::getRoutes()->match(
            app('request')->create("/api/organizations/{$this->organization->id}/invitations", 'POST')
        );

        $this->assertContains('throttle:org-invitations', $route->gatherMiddleware());
        $this->assertNotNull(RateLimiter::limiter('org-invitations'));
    }
}
