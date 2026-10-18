<?php

namespace Tests\Feature;

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
 * huc-14 INV-19: every refusal of the invitee routes is a bare, static
 * message. This file holds the reject halves (U1a); the accept halves and the
 * body-ignoring row (INV-S203) join it in U1b.
 */
class InvitationErrorContractTest extends TestCase
{
    use RefreshDatabase;

    private const IC12_UNAVAILABLE = 'Esta invitación ya no está disponible';

    private const IC13_NOT_FOUND = 'Invitación no encontrada';

    private const IC80_ALREADY_RESPONDED = 'Ya respondiste esta invitación';

    private Organization $organization;

    private User $admin;

    private User $invitee;

    protected function setUp(): void
    {
        parent::setUp();

        Notification::fake();
        Mail::fake();

        $this->admin = User::factory()->create(['role' => 'tenant', 'state' => 'active', 'name' => 'Marina Quispe']);
        $this->invitee = User::factory()->create(['role' => 'tenant', 'state' => 'active']);
        $this->organization = Organization::factory()
            ->withMember($this->admin, OrganizationRole::ADMIN)
            ->create(['name' => 'Cumbres del Sur']);
    }

    private function invitation(string $state = 'pending', ?User $invitee = null): OrganizationInvitation
    {
        $invitee ??= $this->invitee;
        $factory = OrganizationInvitation::factory();

        return ($state === 'pending' ? $factory : $factory->{$state}())->create([
            'organization_id' => $this->organization->id,
            'invited_user_id' => $invitee->id,
            'invited_by_user_id' => $this->admin->id,
            'email' => strtolower($invitee->email),
        ]);
    }

    private function reject(int $id, ?User $caller = null): TestResponse
    {
        return $this->actingAs($caller ?? $this->invitee, 'sanctum')->postJson("/api/invitations/{$id}/reject");
    }

    /**
     * Every refusal reject can produce, keyed by case.
     *
     * @return array<string, TestResponse>
     */
    private function refusals(): array
    {
        $foreign = $this->invitation('pending', User::factory()->create(['role' => 'tenant', 'state' => 'active']));
        $repeat = $this->invitation('rejected');
        $cancelled = $this->invitation('cancelled');
        $lapsed = $this->invitation('lapsed');
        $expired = $this->invitation('expired');

        return [
            'nonexistent' => $this->reject(987654),
            'foreign' => $this->reject($foreign->id),
            'repeat' => $this->reject($repeat->id),
            'cancelled' => $this->reject($cancelled->id),
            'lapsed' => $this->reject($lapsed->id),
            'expired' => $this->reject($expired->id),
        ];
    }

    // INV-S197
    public function test_every_404_and_409_body_has_only_a_message()
    {
        $refusals = $this->refusals();

        $this->assertCount(6, $refusals);
        foreach ($refusals as $response) {
            $this->assertContains($response->getStatusCode(), [404, 409]);
            $this->assertSame(['message'], array_keys($response->json()));
        }
    }

    // INV-S198
    public function test_a_404_says_invitation_not_found()
    {
        $refusals = $this->refusals();

        foreach (['nonexistent', 'foreign'] as $case) {
            $refusals[$case]->assertStatus(404)->assertExactJson(['message' => self::IC13_NOT_FOUND]);
        }
    }

    // INV-S199
    public function test_a_repeat_response_says_you_already_responded()
    {
        $this->refusals()['repeat']->assertStatus(409)->assertExactJson(['message' => self::IC80_ALREADY_RESPONDED]);
    }

    // INV-S200 (reject rows)
    public function test_cancelled_and_expired_invitations_get_byte_identical_409_bodies()
    {
        $refusals = $this->refusals();

        $bodies = [];
        foreach (['cancelled', 'lapsed', 'expired'] as $case) {
            $refusals[$case]->assertStatus(409)->assertExactJson(['message' => self::IC12_UNAVAILABLE]);
            $bodies[] = $refusals[$case]->getContent();
        }
        $this->assertCount(1, array_unique($bodies));
    }

    // INV-S201
    public function test_no_refusal_names_the_organization_the_admin_or_the_inviter()
    {
        foreach ($this->refusals() as $response) {
            $body = $response->getContent();
            $this->assertStringNotContainsString('Cumbres del Sur', $body);
            $this->assertStringNotContainsString('Marina Quispe', $body);
            $this->assertStringNotContainsString($this->admin->email, $body);
        }
    }

    // INV-S202
    public function test_the_401_and_403_texts_are_unchanged()
    {
        $invitation = $this->invitation();
        $landlord = User::factory()->create(['role' => 'landlord', 'state' => 'active']);

        $this->postJson("/api/invitations/{$invitation->id}/reject")
            ->assertStatus(401)
            ->assertExactJson(['message' => 'Unauthenticated.']);
        $this->reject($invitation->id, $landlord)
            ->assertStatus(403)
            ->assertExactJson(['message' => 'No autorizado']);
    }
}
