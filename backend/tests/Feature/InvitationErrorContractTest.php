<?php

namespace Tests\Feature;

use App\Enums\OrganizationRole;
use App\Models\Organization;
use App\Models\OrganizationInvitation;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Notification;
use Illuminate\Testing\TestResponse;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

/**
 * huc-14 INV-19: every refusal of the invitee routes is a bare, static
 * message. The reject halves came with U1a, the accept halves and the
 * body-ignoring row (INV-S203) with U1b.
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

    /**
     * @param  array<string, mixed>  $overrides
     */
    private function invitation(string $state = 'pending', ?User $invitee = null, array $overrides = []): OrganizationInvitation
    {
        $invitee ??= $this->invitee;
        $factory = OrganizationInvitation::factory();

        return ($state === 'pending' ? $factory : $factory->{$state}())->create($overrides + [
            'organization_id' => $this->organization->id,
            'invited_user_id' => $invitee->id,
            'invited_by_user_id' => $this->admin->id,
            'email' => strtolower($invitee->email),
        ]);
    }

    private function respond(string $action, int $id, ?User $caller = null): TestResponse
    {
        return $this->actingAs($caller ?? $this->invitee, 'sanctum')->postJson("/api/invitations/{$id}/{$action}");
    }

    /**
     * @return array<string, array{string, int}>
     */
    public static function actions(): array
    {
        return ['reject' => ['reject', 6], 'accept' => ['accept', 9]];
    }

    /**
     * Every refusal the action can produce, keyed by case. Accept adds the
     * three it alone enforces: organization not active, account not active and
     * already a member.
     *
     * @return array<string, TestResponse>
     */
    private function refusals(string $action): array
    {
        $foreign = $this->invitation('pending', User::factory()->create(['role' => 'tenant', 'state' => 'active']));
        $repeat = $this->invitation('rejected');
        $cancelled = $this->invitation('cancelled');
        $lapsed = $this->invitation('lapsed');
        $expired = $this->invitation('expired');

        $refusals = [
            'nonexistent' => $this->respond($action, 987654),
            'foreign' => $this->respond($action, $foreign->id),
            'repeat' => $this->respond($action, $repeat->id),
            'cancelled' => $this->respond($action, $cancelled->id),
            'lapsed' => $this->respond($action, $lapsed->id),
            'expired' => $this->respond($action, $expired->id),
        ];

        if ($action === 'accept') {
            $north = Organization::factory()->withMember($this->admin, OrganizationRole::ADMIN)->inactive()->create(['name' => 'Cumbres del Norte']);
            $blocked = User::factory()->create(['role' => 'tenant', 'state' => 'blocked']);
            $member = User::factory()->create(['role' => 'tenant', 'state' => 'active']);
            $this->organization->users()->attach($member->id, ['role' => OrganizationRole::MEMBER->value]);

            $refusals['organization inactive'] = $this->respond($action, $this->invitation('pending', $this->invitee, ['organization_id' => $north->id])->id);
            $refusals['user not active'] = $this->respond($action, $this->invitation('pending', $blocked)->id, $blocked);
            $refusals['already member'] = $this->respond($action, $this->invitation('pending', $member)->id, $member);
        }

        return $refusals;
    }

    // INV-S197
    #[DataProvider('actions')]
    public function test_every_404_and_409_body_has_only_a_message(string $action, int $expectedCases)
    {
        $refusals = $this->refusals($action);

        $this->assertCount($expectedCases, $refusals);
        foreach ($refusals as $response) {
            $this->assertContains($response->getStatusCode(), [404, 409]);
            $this->assertSame(['message'], array_keys($response->json()));
        }
    }

    // INV-S198
    #[DataProvider('actions')]
    public function test_a_404_says_invitation_not_found(string $action)
    {
        $refusals = $this->refusals($action);

        foreach (['nonexistent', 'foreign'] as $case) {
            $refusals[$case]->assertStatus(404)->assertExactJson(['message' => self::IC13_NOT_FOUND]);
        }
    }

    // INV-S199
    #[DataProvider('actions')]
    public function test_a_repeat_response_says_you_already_responded(string $action)
    {
        $this->refusals($action)['repeat']->assertStatus(409)->assertExactJson(['message' => self::IC80_ALREADY_RESPONDED]);
    }

    // INV-S200
    #[DataProvider('actions')]
    public function test_every_unavailable_cause_gets_the_byte_identical_409_body(string $action)
    {
        $refusals = $this->refusals($action);
        $cases = ['cancelled', 'lapsed', 'expired'];
        if ($action === 'accept') {
            array_push($cases, 'organization inactive', 'user not active', 'already member');
        }

        $bodies = [];
        foreach ($cases as $case) {
            $refusals[$case]->assertStatus(409)->assertExactJson(['message' => self::IC12_UNAVAILABLE]);
            $bodies[] = $refusals[$case]->getContent();
        }
        $this->assertCount(count($cases), $bodies);
        $this->assertCount(1, array_unique($bodies));
    }

    // INV-S201
    #[DataProvider('actions')]
    public function test_no_refusal_names_the_organization_the_admin_or_the_inviter(string $action)
    {
        foreach ($this->refusals($action) as $response) {
            $body = $response->getContent();
            $this->assertStringNotContainsString('Cumbres del', $body);
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
        $this->respond('reject', $invitation->id, $landlord)
            ->assertStatus(403)
            ->assertExactJson(['message' => 'No autorizado']);
    }

    // INV-S202 (accept)
    public function test_the_accept_401_and_403_texts_are_unchanged()
    {
        $invitation = $this->invitation();
        $landlord = User::factory()->create(['role' => 'landlord', 'state' => 'active']);

        $this->postJson("/api/invitations/{$invitation->id}/accept")
            ->assertStatus(401)
            ->assertExactJson(['message' => 'Unauthenticated.']);
        $this->respond('accept', $invitation->id, $landlord)
            ->assertStatus(403)
            ->assertExactJson(['message' => 'No autorizado']);
    }

    // INV-S203: the body never reaches the membership
    public function test_an_accept_ignores_a_body_that_asks_for_admin_and_a_limit()
    {
        $invitation = $this->invitation();

        $this->actingAs($this->invitee, 'sanctum')
            ->postJson("/api/invitations/{$invitation->id}/accept", ['role' => 'admin', 'monthly_limit' => 5])
            ->assertOk()
            ->assertJsonPath('role', 'member');

        $row = DB::table('organization_user')->where('user_id', $this->invitee->id)->sole();
        $this->assertSame('member', $row->role);
        $this->assertNull($row->monthly_limit);
    }
}
