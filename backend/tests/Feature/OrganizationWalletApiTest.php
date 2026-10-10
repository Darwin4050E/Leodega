<?php

namespace Tests\Feature;

use App\Enums\OrganizationRole;
use App\Enums\WalletMovementType;
use App\Models\Organization;
use App\Models\OrganizationWalletMovement;
use App\Models\Reservations;
use App\Models\User;
use App\Services\WalletService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

/**
 * org-wallet U1b: wallet read side and simulated top-up on the path-based
 * routes (OW-4, OW-11, OW-12). The routes never mount `org.context`; the
 * header is ignored and membership comes from the organization_user pivot.
 */
class OrganizationWalletApiTest extends TestCase
{
    use RefreshDatabase;

    private const NOT_MEMBER = 'No perteneces a la organización seleccionada';

    private const FORBIDDEN_ROLE = 'No autorizado';

    private const AMOUNT_MESSAGE = 'El monto de la recarga debe estar entre $50 y $50.000';

    private function tenant(): User
    {
        return User::factory()->create(['role' => 'tenant']);
    }

    private function organizationFor(User $user, OrganizationRole $role = OrganizationRole::ADMIN, string $balance = '0.00'): Organization
    {
        return Organization::factory()->withMember($user, $role)->withBalance($balance)->create();
    }

    private function addMember(Organization $organization, User $user, OrganizationRole $role = OrganizationRole::MEMBER): void
    {
        $organization->users()->attach($user->id, ['role' => $role->value]);
    }

    private function movement(Organization $organization, ?User $actor, WalletMovementType $type, string $amount, ?Reservations $reservation = null): OrganizationWalletMovement
    {
        return OrganizationWalletMovement::factory()->create([
            'organization_id' => $organization->id,
            'user_id' => $actor?->id,
            'reservation_id' => $reservation?->id,
            'type' => $type,
            'amount' => $amount,
            'balance_after' => '100.00',
        ]);
    }

    private function walletUrl(Organization|int|string $organization, string $suffix = ''): string
    {
        $id = $organization instanceof Organization ? $organization->id : $organization;

        return "/api/organizations/{$id}/wallet{$suffix}";
    }

    private function topUp(User $user, Organization|int|string $organization, mixed $amount, array $headers = [], array $extra = []): \Illuminate\Testing\TestResponse
    {
        return $this->actingAs($user, 'sanctum')
            ->postJson($this->walletUrl($organization, '/top-ups'), array_merge(['amount' => $amount], $extra), $headers);
    }

    private function assertNothingWritten(Organization $organization, string $balance): void
    {
        $this->assertSame(0, OrganizationWalletMovement::where('organization_id', $organization->id)->count());
        $this->assertSame($balance, $organization->fresh()->wallet_balance);
    }

    // ---------------------------------------------------------------
    // Access (OW-S42, S44)
    // ---------------------------------------------------------------

    public static function endpointProvider(): array
    {
        return [
            'balance' => ['GET', ''],
            'movements' => ['GET', '/movements'],
            'top-up' => ['POST', '/top-ups'],
        ];
    }

    #[DataProvider('endpointProvider')]
    public function test_unauthenticated_requests_get_401(string $method, string $suffix)
    {
        $organization = Organization::factory()->create();

        $this->json($method, $this->walletUrl($organization, $suffix), ['amount' => '50.00'])->assertStatus(401);
    }

    #[DataProvider('endpointProvider')]
    public function test_a_landlord_gets_403_no_autorizado(string $method, string $suffix)
    {
        $landlord = User::factory()->create(['role' => 'landlord']);
        $organization = Organization::factory()->create();

        $response = $this->actingAs($landlord, 'sanctum')
            ->json($method, $this->walletUrl($organization, $suffix), ['amount' => '50.00']);

        $response->assertStatus(403);
        $response->assertExactJson(['message' => self::FORBIDDEN_ROLE]);
    }

    #[DataProvider('endpointProvider')]
    public function test_an_admin_account_gets_403_no_autorizado(string $method, string $suffix)
    {
        $admin = User::factory()->create(['role' => 'admin']);
        $organization = Organization::factory()->create();

        $this->actingAs($admin, 'sanctum')
            ->json($method, $this->walletUrl($organization, $suffix), ['amount' => '50.00'])
            ->assertStatus(403)
            ->assertExactJson(['message' => self::FORBIDDEN_ROLE]);
    }

    #[DataProvider('endpointProvider')]
    public function test_a_non_member_gets_the_membership_403_with_only_a_message(string $method, string $suffix)
    {
        $outsider = $this->tenant();
        $foreign = $this->organizationFor($this->tenant(), balance: '80.50');

        $response = $this->actingAs($outsider, 'sanctum')
            ->json($method, $this->walletUrl($foreign, $suffix), ['amount' => '50.00']);

        $response->assertStatus(403);
        $response->assertExactJson(['message' => self::NOT_MEMBER]);
        $this->assertSame(['message'], array_keys($response->json()));
        $this->assertNothingWritten($foreign, '80.50');
    }

    #[DataProvider('endpointProvider')]
    public function test_a_nonexistent_organization_returns_the_identical_body(string $method, string $suffix)
    {
        $tenant = $this->tenant();
        $foreign = $this->organizationFor($this->tenant());

        $existing = $this->actingAs($tenant, 'sanctum')
            ->json($method, $this->walletUrl($foreign, $suffix), ['amount' => '50.00']);
        $missing = $this->actingAs($tenant, 'sanctum')
            ->json($method, $this->walletUrl(9_999_999, $suffix), ['amount' => '50.00']);

        $missing->assertStatus(403);
        $this->assertSame($existing->getContent(), $missing->getContent());
    }

    #[DataProvider('endpointProvider')]
    public function test_an_id_that_does_not_fit_an_int64_never_reaches_the_controller(string $method, string $suffix)
    {
        $tenant = $this->tenant();

        $this->actingAs($tenant, 'sanctum')
            ->json($method, $this->walletUrl('9999999999999999999', $suffix), ['amount' => '50.00'])
            ->assertStatus(404);
    }

    public function test_a_non_numeric_or_zero_padded_id_is_a_404()
    {
        $tenant = $this->tenant();

        foreach (['abc', '0', '01'] as $id) {
            $this->actingAs($tenant, 'sanctum')->getJson($this->walletUrl($id))->assertStatus(404);
        }
    }

    // ---------------------------------------------------------------
    // Balance (OW-S1, S39, S43)
    // ---------------------------------------------------------------

    public function test_a_member_reads_the_organization_balance()
    {
        $member = $this->tenant();
        $organization = $this->organizationFor($this->tenant(), balance: '80.50');
        $this->addMember($organization, $member);

        $response = $this->actingAs($member, 'sanctum')->getJson($this->walletUrl($organization));

        $response->assertStatus(200);
        $response->assertExactJson(['organization_id' => $organization->id, 'balance' => '80.50']);
    }

    public function test_an_admin_reads_the_organization_balance()
    {
        $admin = $this->tenant();
        $organization = $this->organizationFor($admin, balance: '1234.00');

        $this->actingAs($admin, 'sanctum')->getJson($this->walletUrl($organization))
            ->assertStatus(200)
            ->assertJsonPath('balance', '1234.00');
    }

    public function test_the_path_organization_wins_over_the_header()
    {
        $user = $this->tenant();
        $first = $this->organizationFor($user, balance: '10.00');
        $second = $this->organizationFor($user, balance: '20.00');

        $response = $this->actingAs($user, 'sanctum')
            ->getJson($this->walletUrl($first), ['X-Organization-Id' => (string) $second->id]);

        $response->assertStatus(200);
        $this->assertSame($first->id, $response->json('organization_id'));
        $this->assertSame('10.00', $response->json('balance'));
    }

    public function test_a_malformed_or_foreign_header_is_ignored()
    {
        $user = $this->tenant();
        $organization = $this->organizationFor($user, balance: '10.00');
        $foreign = $this->organizationFor($this->tenant());

        foreach (['abc', (string) $foreign->id] as $header) {
            $this->actingAs($user, 'sanctum')
                ->getJson($this->walletUrl($organization), ['X-Organization-Id' => $header])
                ->assertStatus(200)
                ->assertJsonPath('balance', '10.00');
        }
    }

    public function test_an_organization_created_through_the_api_starts_at_zero_with_no_movements()
    {
        $tenant = $this->tenant();

        $created = $this->actingAs($tenant, 'sanctum')->postJson('/api/organizations', [
            'name' => 'Importadora Andina S.A.',
            'ruc' => '1790012345001',
            'email' => 'contacto@andina.ec',
        ]);
        $created->assertStatus(201);
        $id = $created->json('organization.id');

        $this->actingAs($tenant, 'sanctum')->getJson($this->walletUrl($id))
            ->assertStatus(200)
            ->assertJsonPath('balance', '0.00');
        $this->actingAs($tenant, 'sanctum')->getJson($this->walletUrl($id, '/movements'))
            ->assertStatus(200)
            ->assertExactJson([]);
    }

    // ---------------------------------------------------------------
    // Movements (OW-S38, S40, S5)
    // ---------------------------------------------------------------

    public function test_an_admin_sees_every_movement_newest_first_including_top_ups()
    {
        $admin = $this->tenant();
        $memberA = $this->tenant();
        $organization = $this->organizationFor($admin);
        $this->addMember($organization, $memberA);
        $reservation = Reservations::factory()->forOrganization($organization)->create();

        $recarga = $this->movement($organization, $admin, WalletMovementType::Recarga, '100.00');
        $reserva = $this->movement($organization, $memberA, WalletMovementType::Reserva, '-40.00', $reservation);
        $reembolso = $this->movement($organization, $memberA, WalletMovementType::Reembolso, '20.00', $reservation);

        $response = $this->actingAs($admin, 'sanctum')->getJson($this->walletUrl($organization, '/movements'));

        $response->assertStatus(200);
        $this->assertSame([$reembolso->id, $reserva->id, $recarga->id], array_column($response->json(), 'id'));
    }

    public function test_a_movement_exposes_the_documented_fields_only()
    {
        $admin = $this->tenant();
        $organization = $this->organizationFor($admin);
        $reservation = Reservations::factory()->forOrganization($organization)->create();
        $movement = $this->movement($organization, $admin, WalletMovementType::Reserva, '-40.00', $reservation);

        $row = $this->actingAs($admin, 'sanctum')
            ->getJson($this->walletUrl($organization, '/movements'))
            ->json(0);

        $this->assertEqualsCanonicalizing(
            ['id', 'type', 'amount', 'balance_after', 'reservation_id', 'actor_name', 'created_at'],
            array_keys($row),
        );
        $this->assertSame($movement->id, $row['id']);
        $this->assertSame('reserva', $row['type']);
        $this->assertSame('-40.00', $row['amount']);
        $this->assertSame('100.00', $row['balance_after']);
        $this->assertSame($reservation->id, $row['reservation_id']);
        $this->assertSame($admin->name, $row['actor_name']);
        $this->assertNotNull($row['created_at']);
    }

    public function test_a_movement_without_a_reservation_or_actor_serializes_nulls()
    {
        $admin = $this->tenant();
        $organization = $this->organizationFor($admin);
        $this->movement($organization, null, WalletMovementType::Recarga, '100.00');

        $row = $this->actingAs($admin, 'sanctum')
            ->getJson($this->walletUrl($organization, '/movements'))
            ->json(0);

        $this->assertNull($row['reservation_id']);
        $this->assertNull($row['actor_name']);
    }

    public function test_a_member_sees_only_their_own_reservation_and_refund_movements()
    {
        $admin = $this->tenant();
        $memberA = $this->tenant();
        $memberB = $this->tenant();
        $organization = $this->organizationFor($admin);
        $this->addMember($organization, $memberA);
        $this->addMember($organization, $memberB);
        $reservationA = Reservations::factory()->forOrganization($organization)->create();
        $reservationB = Reservations::factory()->forOrganization($organization)->create();

        $this->movement($organization, $admin, WalletMovementType::Recarga, '100.00');
        $mineReserva = $this->movement($organization, $memberA, WalletMovementType::Reserva, '-40.00', $reservationA);
        $this->movement($organization, $memberB, WalletMovementType::Reserva, '-30.00', $reservationB);
        $mineReembolso = $this->movement($organization, $memberA, WalletMovementType::Reembolso, '20.00', $reservationA);

        $response = $this->actingAs($memberA, 'sanctum')->getJson($this->walletUrl($organization, '/movements'));

        $response->assertStatus(200);
        $this->assertSame([$mineReembolso->id, $mineReserva->id], array_column($response->json(), 'id'));
    }

    public function test_a_member_never_sees_a_top_up_even_one_attributed_to_them()
    {
        $admin = $this->tenant();
        $member = $this->tenant();
        $organization = $this->organizationFor($admin);
        $this->addMember($organization, $member);
        $this->movement($organization, $member, WalletMovementType::Recarga, '100.00');

        $this->actingAs($member, 'sanctum')
            ->getJson($this->walletUrl($organization, '/movements'))
            ->assertExactJson([]);
    }

    public function test_a_refund_on_a_members_reservation_is_visible_to_them_and_not_to_a_peer()
    {
        $admin = $this->tenant();
        $memberA = $this->tenant();
        $memberB = $this->tenant();
        $organization = $this->organizationFor($admin);
        $this->addMember($organization, $memberA);
        $this->addMember($organization, $memberB);
        $reservation = Reservations::factory()->forOrganization($organization)->create();
        // Cancelled by the gestor, yet attributed to the creator (OW-10).
        $refund = $this->movement($organization, $memberA, WalletMovementType::Reembolso, '100.00', $reservation);

        $forA = $this->actingAs($memberA, 'sanctum')->getJson($this->walletUrl($organization, '/movements'));
        $forB = $this->actingAs($memberB, 'sanctum')->getJson($this->walletUrl($organization, '/movements'));

        $this->assertSame([$refund->id], array_column($forA->json(), 'id'));
        $forB->assertExactJson([]);
    }

    public function test_movements_of_another_organization_are_never_listed()
    {
        $admin = $this->tenant();
        $organization = $this->organizationFor($admin);
        $other = Organization::factory()->create();
        $this->movement($other, null, WalletMovementType::Recarga, '100.00');

        $this->actingAs($admin, 'sanctum')
            ->getJson($this->walletUrl($organization, '/movements'))
            ->assertExactJson([]);
    }

    public function test_the_list_is_capped_at_the_latest_fifty()
    {
        $admin = $this->tenant();
        $organization = $this->organizationFor($admin);
        $created = collect(range(1, 55))
            ->map(fn () => $this->movement($organization, $admin, WalletMovementType::Recarga, '50.00'));

        $response = $this->actingAs($admin, 'sanctum')->getJson($this->walletUrl($organization, '/movements'));

        $ids = array_column($response->json(), 'id');
        $this->assertCount(50, $ids);
        $this->assertSame($created->last()->id, $ids[0]);
        $this->assertSame($created[5]->id, $ids[49]);
    }

    public function test_the_ledger_cannot_be_edited_or_deleted_over_http()
    {
        $admin = $this->tenant();
        $organization = $this->organizationFor($admin);
        $movement = $this->movement($organization, $admin, WalletMovementType::Recarga, '100.00');
        $this->actingAs($admin, 'sanctum');

        foreach (['PUT', 'PATCH', 'DELETE'] as $method) {
            $this->assertContains(
                $this->json($method, $this->walletUrl($organization, '/movements'))->getStatusCode(),
                [404, 405],
            );
            $this->assertContains(
                $this->json($method, $this->walletUrl($organization, "/movements/{$movement->id}"))->getStatusCode(),
                [404, 405],
            );
        }

        $this->assertDatabaseHas('organization_wallet_movements', ['id' => $movement->id, 'amount' => '100.00']);
    }

    // ---------------------------------------------------------------
    // Top-up (OW-S10..S14)
    // ---------------------------------------------------------------

    public function test_an_admin_tops_up_the_wallet()
    {
        $admin = $this->tenant();
        $organization = $this->organizationFor($admin);

        $response = $this->topUp($admin, $organization, '50.00');

        $response->assertStatus(201);
        $response->assertJsonPath('message', 'Recarga realizada correctamente');
        $response->assertJsonPath('balance', '50.00');
        $this->assertEqualsCanonicalizing(['message', 'balance', 'movement'], array_keys($response->json()));
        $this->assertSame('recarga', $response->json('movement.type'));
        $this->assertSame('50.00', $response->json('movement.amount'));
        $this->assertSame('50.00', $response->json('movement.balance_after'));
        $this->assertSame($admin->name, $response->json('movement.actor_name'));
        $this->assertNull($response->json('movement.reservation_id'));

        $this->assertSame('50.00', $organization->fresh()->wallet_balance);
        $this->assertDatabaseHas('organization_wallet_movements', [
            'organization_id' => $organization->id,
            'user_id' => $admin->id,
            'type' => 'recarga',
            'amount' => '50.00',
            'balance_after' => '50.00',
        ]);
        $this->assertSame(1, OrganizationWalletMovement::count());
    }

    public function test_a_top_up_adds_to_the_existing_balance_and_each_request_writes_a_movement()
    {
        $admin = $this->tenant();
        $organization = $this->organizationFor($admin, balance: '10.50');

        $this->topUp($admin, $organization, '100.25')->assertStatus(201)->assertJsonPath('balance', '110.75');
        $this->topUp($admin, $organization, '100.25')->assertStatus(201)->assertJsonPath('balance', '211.00');

        $this->assertSame(2, OrganizationWalletMovement::count());
        $this->assertSame('211.00', $organization->fresh()->wallet_balance);
    }

    public function test_a_top_up_accepts_a_json_number()
    {
        $admin = $this->tenant();
        $organization = $this->organizationFor($admin);

        $this->topUp($admin, $organization, 100)->assertStatus(201)->assertJsonPath('balance', '100.00');
        $this->topUp($admin, $organization, 50.5)->assertStatus(201)->assertJsonPath('balance', '150.50');
    }

    public function test_the_path_organization_is_credited_not_the_header_one()
    {
        $admin = $this->tenant();
        $first = $this->organizationFor($admin);
        $second = $this->organizationFor($admin);

        $this->topUp($admin, $first, '60.00', ['X-Organization-Id' => (string) $second->id])->assertStatus(201);

        $this->assertSame('60.00', $first->fresh()->wallet_balance);
        $this->assertSame('0.00', $second->fresh()->wallet_balance);
    }

    public function test_an_inactive_organization_can_still_be_topped_up()
    {
        $admin = $this->tenant();
        $organization = Organization::factory()->inactive()->withMember($admin)->create();

        $this->topUp($admin, $organization, '50.00')->assertStatus(201);
    }

    #[DataProvider('boundaryAmountProvider')]
    public function test_the_inclusive_bounds_are_accepted(string $amount, string $balance)
    {
        $admin = $this->tenant();
        $organization = $this->organizationFor($admin);

        $this->topUp($admin, $organization, $amount)->assertStatus(201)->assertJsonPath('balance', $balance);
    }

    public static function boundaryAmountProvider(): array
    {
        return [
            'minimum' => ['50.00', '50.00'],
            'maximum' => ['50000.00', '50000.00'],
            'without decimals' => ['50', '50.00'],
        ];
    }

    #[DataProvider('invalidAmountProvider')]
    public function test_every_invalid_amount_gets_the_same_422_and_changes_nothing(mixed $amount)
    {
        $admin = $this->tenant();
        $organization = $this->organizationFor($admin, balance: '5.00');

        $response = $this->topUp($admin, $organization, $amount);

        $response->assertStatus(422);
        $response->assertJsonPath('message', self::AMOUNT_MESSAGE);
        $response->assertJsonPath('errors.amount', [self::AMOUNT_MESSAGE]);
        $this->assertSame(0, OrganizationWalletMovement::count());
        $this->assertSame('5.00', $organization->fresh()->wallet_balance);
    }

    public static function invalidAmountProvider(): array
    {
        return [
            'below the minimum' => ['49.99'],
            'above the maximum' => ['50000.01'],
            'three decimals' => ['100.005'],
            'non-numeric' => ['abc'],
            'empty string' => [''],
            'null' => [null],
            'negative' => ['-100.00'],
            'zero' => ['0'],
            'scientific notation' => ['1e2'],
            'decimal comma' => ['100,00'],
            'trailing dot' => ['100.'],
            'array' => [['100']],
            'boolean' => [true],
        ];
    }

    public function test_a_missing_amount_gets_the_same_422()
    {
        $admin = $this->tenant();
        $organization = $this->organizationFor($admin);

        $this->actingAs($admin, 'sanctum')
            ->postJson($this->walletUrl($organization, '/top-ups'), [])
            ->assertStatus(422)
            ->assertJsonPath('errors.amount', [self::AMOUNT_MESSAGE]);
    }

    public function test_a_top_up_over_the_column_capacity_is_a_422_on_amount()
    {
        $admin = $this->tenant();
        $organization = $this->organizationFor($admin, balance: '99999999.00');

        $response = $this->topUp($admin, $organization, '50.00');

        $response->assertStatus(422);
        $response->assertJsonPath('errors.amount', [WalletService::CAPACITY_MESSAGE]);
        $this->assertSame(0, OrganizationWalletMovement::count());
        $this->assertSame('99999999.00', $organization->fresh()->wallet_balance);
    }

    public function test_a_member_cannot_top_up_even_with_an_invalid_amount()
    {
        $admin = $this->tenant();
        $member = $this->tenant();
        $organization = $this->organizationFor($admin, balance: '5.00');
        $this->addMember($organization, $member);

        foreach (['50.00', '1'] as $amount) {
            $this->topUp($member, $organization, $amount)
                ->assertStatus(403)
                ->assertExactJson(['message' => self::FORBIDDEN_ROLE]);
        }

        $this->assertSame(0, OrganizationWalletMovement::count());
        $this->assertSame('5.00', $organization->fresh()->wallet_balance);
    }

    public function test_an_admin_of_another_organization_cannot_top_up_this_one()
    {
        $admin = $this->tenant();
        $own = $this->organizationFor($admin);
        $foreign = $this->organizationFor($this->tenant());

        $this->topUp($admin, $foreign, '50.00')
            ->assertStatus(403)
            ->assertExactJson(['message' => self::NOT_MEMBER]);

        $this->assertNothingWritten($foreign, '0.00');
        $this->assertNothingWritten($own, '0.00');
    }

    public function test_no_card_data_is_persisted_or_echoed()
    {
        $admin = $this->tenant();
        $organization = $this->organizationFor($admin);

        $response = $this->topUp($admin, $organization, '50.00', [], [
            'card_number' => '4111111111111111',
            'card_holder' => 'Andina',
            'cvv' => '123',
        ]);

        $response->assertStatus(201);
        $this->assertStringNotContainsString('4111111111111111', $response->getContent());
        $this->assertStringNotContainsString('cvv', strtolower($response->getContent()));
        $this->assertSame(
            ['id', 'organization_id', 'user_id', 'reservation_id', 'type', 'amount', 'balance_after', 'created_at'],
            array_keys((array) DB::table('organization_wallet_movements')->first()),
        );
    }

    public function test_the_ledger_stays_consistent_after_top_ups()
    {
        $admin = $this->tenant();
        $organization = $this->organizationFor($admin);

        $this->topUp($admin, $organization, '50.00');
        $this->topUp($admin, $organization, '75.10');

        $last = OrganizationWalletMovement::query()->orderByDesc('id')->first();
        $this->assertSame($organization->fresh()->wallet_balance, $last->balance_after);
        $this->assertSame('125.10', $last->balance_after);
        $this->assertSame(
            12510,
            (int) round(OrganizationWalletMovement::where('organization_id', $organization->id)->sum('amount') * 100),
        );
    }
}
