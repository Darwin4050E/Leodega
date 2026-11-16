<?php

namespace Tests\Feature;

use App\Enums\OrganizationRole;
use App\Enums\WalletMovementType;
use App\Models\Organization;
use App\Models\OrganizationInvitation;
use App\Models\OrganizationWalletMovement;
use App\Models\Reservations;
use App\Models\User;
use App\Services\SpendingLimitService;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Testing\TestResponse;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

/**
 * member-spending-limit U1b: list and set endpoints (ML-13..ML-15). Path
 * based, `org.context` is not mounted, so the X-Organization-Id header plays
 * no role and membership comes from the organization_user pivot.
 */
class SpendingLimitApiTest extends TestCase
{
    use RefreshDatabase;

    private const NOT_MEMBER = 'No perteneces a la organización seleccionada';

    private const FORBIDDEN_ROLE = 'No autorizado';

    private const MEMBER_NOT_FOUND = 'Miembro no encontrado';

    private const LIMIT_MESSAGE = 'El límite mensual debe ser un monto mayor que 0, con hasta 6 dígitos enteros y 2 decimales';

    private Organization $organization;

    private User $admin;

    private User $member;

    protected function setUp(): void
    {
        parent::setUp();

        Carbon::setTestNow('2026-10-10 12:00:00');

        $this->admin = $this->tenant();
        $this->member = $this->tenant();
        $this->organization = Organization::factory()
            ->withMember($this->admin, OrganizationRole::ADMIN)
            ->withMember($this->member, OrganizationRole::MEMBER, '500.00')
            ->create();
    }

    protected function tearDown(): void
    {
        Carbon::setTestNow();

        parent::tearDown();
    }

    private function tenant(): User
    {
        return User::factory()->create(['role' => 'tenant']);
    }

    private function url(Organization|int|string $organization, User|int|string|null $user = null): string
    {
        $organizationId = $organization instanceof Organization ? $organization->id : $organization;
        $userId = $user instanceof User ? $user->id : $user;

        return "/api/organizations/{$organizationId}/spending-limits".($userId === null ? '' : "/{$userId}");
    }

    private function list(?User $caller, Organization|int|string|null $organization = null, array $headers = []): TestResponse
    {
        $request = $caller ? $this->actingAs($caller, 'sanctum') : $this;

        return $request->getJson($this->url($organization ?? $this->organization), $headers);
    }

    private function setLimit(?User $caller, User|int|string $target, mixed $body, Organization|int|string|null $organization = null): TestResponse
    {
        $request = $caller ? $this->actingAs($caller, 'sanctum') : $this;

        return $request->putJson($this->url($organization ?? $this->organization, $target), $body);
    }

    /**
     * SQLite hands DECIMAL back as int or float, so normalize like the API.
     */
    private function storedLimit(User $user, ?Organization $organization = null): ?string
    {
        return SpendingLimitService::formatLimit(DB::table('organization_user')
            ->where('organization_id', ($organization ?? $this->organization)->id)
            ->where('user_id', $user->id)
            ->value('monthly_limit'));
    }

    private function spend(User $user, string $type, string $amount, string $start, ?Organization $organization = null): void
    {
        $organization ??= $this->organization;
        $reservation = Reservations::factory()->forOrganization($organization)->create([
            'start_date' => $start,
            'end_date' => Carbon::parse($start)->addDays(5)->toDateString(),
        ]);

        OrganizationWalletMovement::factory()->create([
            'organization_id' => $organization->id,
            'user_id' => $user->id,
            'reservation_id' => $reservation->id,
            'type' => $type,
            'amount' => $amount,
        ]);
    }

    // ---------------------------------------------------------------
    // Access (ML-15, ML-S59, S60, S61, S62)
    // ---------------------------------------------------------------

    public static function endpointProvider(): array
    {
        return [
            'list' => ['GET', false],
            'set' => ['PUT', true],
        ];
    }

    private function hit(?User $caller, string $method, bool $withTarget, Organization|int|string $organization, User|int|string|null $target = null): TestResponse
    {
        $request = $caller ? $this->actingAs($caller, 'sanctum') : $this;

        return $request->json($method, $this->url($organization, $withTarget ? ($target ?? $this->member) : null), ['monthly_limit' => '10.00']);
    }

    #[DataProvider('endpointProvider')]
    public function test_unauthenticated_requests_get_401(string $method, bool $withTarget)
    {
        $this->hit(null, $method, $withTarget, $this->organization)->assertStatus(401);
    }

    #[DataProvider('endpointProvider')]
    public function test_a_landlord_gets_403_no_autorizado(string $method, bool $withTarget)
    {
        $landlord = User::factory()->create(['role' => 'landlord']);

        $this->hit($landlord, $method, $withTarget, $this->organization)
            ->assertStatus(403)
            ->assertExactJson(['message' => self::FORBIDDEN_ROLE]);
    }

    #[DataProvider('endpointProvider')]
    public function test_a_non_member_and_a_nonexistent_organization_get_the_same_403(string $method, bool $withTarget)
    {
        $outsider = $this->tenant();

        $existing = $this->hit($outsider, $method, $withTarget, $this->organization);
        $missing = $this->hit($outsider, $method, $withTarget, 9_999_999);

        $existing->assertStatus(403)->assertExactJson(['message' => self::NOT_MEMBER]);
        $this->assertSame($existing->getContent(), $missing->getContent());
        $this->assertSame('500.00', $this->storedLimit($this->member));
    }

    #[DataProvider('endpointProvider')]
    public function test_an_id_that_does_not_fit_an_int64_is_a_404(string $method, bool $withTarget)
    {
        $this->hit($this->admin, $method, $withTarget, '9999999999999999999')->assertStatus(404);

        if ($withTarget) {
            $this->hit($this->admin, $method, $withTarget, $this->organization, '9999999999999999999')->assertStatus(404);
        }
    }

    public function test_the_path_organization_wins_over_the_header()
    {
        $other = Organization::factory()->withMember($this->admin, OrganizationRole::ADMIN)->create();

        $response = $this->list($this->admin, $this->organization, ['X-Organization-Id' => (string) $other->id]);

        $response->assertStatus(200);
        $this->assertCount(2, $response->json());
    }

    // ---------------------------------------------------------------
    // List (ML-13, ML-S46..S50)
    // ---------------------------------------------------------------

    public function test_an_admin_sees_every_member_in_pivot_order_with_limit_and_spent()
    {
        $this->spend($this->member, WalletMovementType::Reserva->value, '-300.00', '2026-10-20');
        $foreign = Organization::factory()->withMember($this->tenant(), OrganizationRole::ADMIN)->create();

        $response = $this->list($this->admin);

        $response->assertStatus(200);
        $response->assertExactJson([
            ['user_id' => $this->admin->id, 'name' => $this->admin->name, 'role' => 'admin', 'monthly_limit' => null, 'spent' => '0.00'],
            ['user_id' => $this->member->id, 'name' => $this->member->name, 'role' => 'member', 'monthly_limit' => '500.00', 'spent' => '300.00'],
        ]);
        $this->assertNotContains($foreign->users()->first()->id, array_column($response->json(), 'user_id'));
    }

    // hue-01 INV-S126: an invitee is not a member, so a pending invitation
    // never shows up in the member list.
    public function test_a_pending_invitation_does_not_add_a_row_to_the_member_list()
    {
        OrganizationInvitation::factory()->create(['organization_id' => $this->organization->id]);

        $response = $this->list($this->admin);

        $response->assertStatus(200);
        $this->assertSame([$this->admin->id, $this->member->id], array_column($response->json(), 'user_id'));
    }

    public function test_a_member_sees_exactly_their_own_row()
    {
        $this->spend($this->admin, WalletMovementType::Reserva->value, '-80.00', '2026-10-12');

        $response = $this->list($this->member);

        $response->assertStatus(200);
        $response->assertExactJson([
            ['user_id' => $this->member->id, 'name' => $this->member->name, 'role' => 'member', 'monthly_limit' => '500.00', 'spent' => '0.00'],
        ]);
    }

    public function test_spent_is_the_guard_figure_net_of_refunds_for_the_current_month_only()
    {
        Carbon::setTestNow('2026-10-31 23:59:00');
        $this->spend($this->member, WalletMovementType::Reserva->value, '-300.00', '2026-10-31');
        $this->spend($this->member, WalletMovementType::Reembolso->value, '100.00', '2026-10-01');
        $this->spend($this->member, WalletMovementType::Reserva->value, '-900.00', '2026-11-01');
        $this->spend($this->member, WalletMovementType::Reserva->value, '-700.00', '2026-09-30');
        $this->spend($this->member, WalletMovementType::Recarga->value, '400.00', '2026-10-15');

        $this->list($this->member)->assertJsonPath('0.spent', '200.00');
    }

    // ---------------------------------------------------------------
    // Set and clear (ML-14, ML-S51..S57, S43)
    // ---------------------------------------------------------------

    public function test_an_admin_sets_a_members_limit_and_the_list_shows_it()
    {
        $this->setLimit($this->admin, $this->member, ['monthly_limit' => '750.00'])
            ->assertStatus(200)
            ->assertExactJson([
                'user_id' => $this->member->id, 'name' => $this->member->name, 'role' => 'member', 'monthly_limit' => '750.00', 'spent' => '0.00',
            ]);

        $this->list($this->member)->assertJsonPath('0.monthly_limit', '750.00');
    }

    public function test_an_admin_sets_their_own_limit()
    {
        $this->setLimit($this->admin, $this->admin, ['monthly_limit' => '90.00'])->assertStatus(200);

        $this->assertSame('90.00', $this->storedLimit($this->admin));
    }

    public function test_an_admin_sets_another_admins_limit()
    {
        $second = $this->tenant();
        $this->organization->users()->attach($second->id, ['role' => 'admin']);

        $this->setLimit($this->admin, $second, ['monthly_limit' => '40'])->assertStatus(200);

        $this->assertSame('40.00', $this->storedLimit($second));
    }

    public function test_null_clears_the_limit()
    {
        $this->setLimit($this->admin, $this->member, ['monthly_limit' => null])
            ->assertStatus(200)
            ->assertJsonPath('monthly_limit', null);

        $this->assertNull($this->storedLimit($this->member));
    }

    public static function validLimitProvider(): array
    {
        return [
            'one cent' => ['0.01', '0.01'],
            'whole string' => ['1', '1.00'],
            'one decimal' => ['1500.5', '1500.50'],
            'json number' => [1500.5, '1500.50'],
            'maximum' => ['999999.99', '999999.99'],
        ];
    }

    #[DataProvider('validLimitProvider')]
    public function test_valid_limits_are_stored_with_scale_two(mixed $sent, string $expected)
    {
        $this->setLimit($this->admin, $this->member, ['monthly_limit' => $sent])
            ->assertStatus(200)
            ->assertJsonPath('monthly_limit', $expected);

        $this->assertSame($expected, $this->storedLimit($this->member));
    }

    public static function invalidLimitProvider(): array
    {
        return [
            'zero' => [['monthly_limit' => '0']],
            'zero with decimals' => [['monthly_limit' => '0.00']],
            'negative' => [['monthly_limit' => '-1']],
            'seven integer digits' => [['monthly_limit' => '1000000']],
            'seven integer digits with decimals' => [['monthly_limit' => '1000000.00']],
            'three decimals, not rounded' => [['monthly_limit' => '10.005']],
            'text' => [['monthly_limit' => 'abc']],
            'array' => [['monthly_limit' => [1]]],
            'missing key' => [[]],
        ];
    }

    #[DataProvider('invalidLimitProvider')]
    public function test_invalid_limits_are_a_422_and_leave_the_limit_unchanged(array $body)
    {
        $response = $this->setLimit($this->admin, $this->member, $body);

        $response->assertStatus(422);
        $this->assertSame(self::LIMIT_MESSAGE, $response->json('errors.monthly_limit.0'));
        $this->assertSame('500.00', $this->storedLimit($this->member));
    }

    public function test_a_member_cannot_set_any_limit_even_their_own()
    {
        foreach ([$this->member, $this->admin] as $target) {
            $this->setLimit($this->member, $target, ['monthly_limit' => '9.00'])
                ->assertStatus(403)
                ->assertExactJson(['message' => self::FORBIDDEN_ROLE]);
        }

        $this->assertSame('500.00', $this->storedLimit($this->member));
        $this->assertNull($this->storedLimit($this->admin));
    }

    public function test_a_member_gets_the_role_403_before_any_validation_error()
    {
        $this->setLimit($this->member, $this->member, ['monthly_limit' => 'abc'])->assertStatus(403);
    }

    public function test_a_target_that_is_not_a_member_is_a_404_with_the_same_body_as_a_nonexistent_user()
    {
        $stranger = $this->tenant();
        Organization::factory()->withMember($stranger, OrganizationRole::ADMIN, '10.00')->create();

        $outsider = $this->setLimit($this->admin, $stranger, ['monthly_limit' => '9.00']);
        $missing = $this->setLimit($this->admin, 9_999_999, ['monthly_limit' => '9.00']);

        $outsider->assertStatus(404)->assertExactJson(['message' => self::MEMBER_NOT_FOUND]);
        $this->assertSame($outsider->getContent(), $missing->getContent());
        $this->assertSame('10.00', $this->storedLimit($stranger, $stranger->organizations()->first()));
    }

    public function test_validation_wins_over_the_missing_member_check()
    {
        $this->setLimit($this->admin, 9_999_999, ['monthly_limit' => 'abc'])->assertStatus(422);
    }

    public function test_an_admin_of_one_organization_cannot_set_limits_in_another()
    {
        $other = Organization::factory()->withMember($this->tenant(), OrganizationRole::ADMIN)->create();

        $this->setLimit($this->admin, $this->member, ['monthly_limit' => '9.00'], $other)
            ->assertStatus(403)
            ->assertExactJson(['message' => self::NOT_MEMBER]);

        $this->assertSame('500.00', $this->storedLimit($this->member));
    }

    public function test_lowering_a_limit_below_the_current_spend_is_allowed_and_keeps_reservations()
    {
        $this->spend($this->member, WalletMovementType::Reserva->value, '-400.00', '2026-10-20');

        $this->setLimit($this->admin, $this->member, ['monthly_limit' => '100.00'])
            ->assertStatus(200)
            ->assertJsonPath('monthly_limit', '100.00')
            ->assertJsonPath('spent', '400.00');

        $this->assertSame(['confirmed'], Reservations::query()->pluck('status')->unique()->all());
    }
}
