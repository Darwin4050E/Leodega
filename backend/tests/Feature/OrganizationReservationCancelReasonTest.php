<?php

namespace Tests\Feature;

use App\Enums\OrganizationRole;
use App\Http\Requests\CancelReservationAsTenantRequest;
use App\Models\Organization;
use App\Models\Reservations;
use App\Models\StoreRooms;
use App\Models\Tenants;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Notification;
use Illuminate\Testing\TestResponse;
use Tests\TestCase;

/**
 * HUE-06 OR-16: the cancel reason of an organization reservation is required,
 * trimmed, and 10 to 200 characters (not bytes); a personal one stays optional.
 */
class OrganizationReservationCancelReasonTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;

    private User $creator;

    private Organization $organization;

    protected function setUp(): void
    {
        parent::setUp();

        Notification::fake();

        $this->creator = $this->tenantUser();
        $this->admin = $this->tenantUser();
        $this->organization = Organization::factory()
            ->withBalance('1000.00')
            ->withMember($this->creator, OrganizationRole::MEMBER)
            ->withMember($this->admin, OrganizationRole::ADMIN)
            ->create();
    }

    private function tenantUser(): User
    {
        $user = User::factory()->create(['role' => 'tenant']);
        Tenants::factory()->create(['user_id' => $user->id]);

        return $user;
    }

    private function reservation(bool $organization = true): Reservations
    {
        $factory = Reservations::factory();
        if ($organization) {
            $factory = $factory->forOrganization($this->organization);
        }

        return $factory->create([
            'store_room_id' => StoreRooms::factory()->approved()->create()->id,
            'tenant_id' => $this->creator->tenant->id,
            'status' => 'confirmed',
            'start_date' => now()->addDays(10)->toDateString(),
            'end_date' => now()->addDays(40)->toDateString(),
            'total_mount' => '100.00',
            'cancellation_policy_tier' => 'flexible',
        ]);
    }

    private function cancelWith(Reservations $reservation, array $body, ?User $as = null): TestResponse
    {
        return $this->actingAs($as ?? $this->admin, 'sanctum')
            ->patchJson("/api/tenant/reservations/{$reservation->id}/cancel", $body);
    }

    private function assertRejected(TestResponse $response, Reservations $reservation, string $message): void
    {
        $response->assertStatus(422);
        $this->assertSame($message, $response->json('errors.reason.0'));
        $this->assertSame(['message', 'errors'], array_keys($response->json()));
        $this->assertDatabaseHas('reservations', ['id' => $reservation->id, 'status' => 'confirmed', 'cancelation_reason' => null]);
        $this->assertSame('1000.00', $this->organization->fresh()->wallet_balance);
        $this->assertSame(0, DB::table('organization_wallet_movements')->count());
    }

    public function test_the_copy_matches_the_approved_spanish_strings()
    {
        $this->assertSame('El motivo debe tener al menos 10 caracteres.', CancelReservationAsTenantRequest::REASON_MIN_MESSAGE);
        $this->assertSame('El motivo no puede superar los 200 caracteres.', CancelReservationAsTenantRequest::REASON_MAX_MESSAGE);
    }

    public function test_a_reason_of_exactly_ten_characters_is_accepted_and_stored()
    {
        $reservation = $this->reservation();

        $this->cancelWith($reservation, ['reason' => '1234567890'])->assertOk();

        $this->assertDatabaseHas('reservations', ['id' => $reservation->id, 'status' => 'canceled', 'cancelation_reason' => '1234567890']);
    }

    public function test_a_reason_of_nine_characters_is_rejected_with_the_min_message()
    {
        $reservation = $this->reservation();

        $this->assertRejected(
            $this->cancelWith($reservation, ['reason' => '123456789']),
            $reservation,
            CancelReservationAsTenantRequest::REASON_MIN_MESSAGE,
        );
    }

    public function test_the_reason_is_trimmed_before_it_is_measured_and_stored()
    {
        $short = $this->reservation();
        $padded = $this->reservation();

        $this->assertRejected(
            $this->cancelWith($short, ['reason' => '   abc   ']),
            $short,
            CancelReservationAsTenantRequest::REASON_MIN_MESSAGE,
        );
        $this->cancelWith($padded, ['reason' => '  1234567890  '])->assertOk();

        $this->assertDatabaseHas('reservations', ['id' => $padded->id, 'cancelation_reason' => '1234567890']);
    }

    public function test_a_missing_null_or_blank_reason_is_rejected_with_the_min_message()
    {
        foreach ([[], ['reason' => null], ['reason' => '   '], ['reason' => '']] as $body) {
            $reservation = $this->reservation();

            $this->assertRejected(
                $this->cancelWith($reservation, $body),
                $reservation,
                CancelReservationAsTenantRequest::REASON_MIN_MESSAGE,
            );
        }
    }

    public function test_the_upper_bound_is_two_hundred_characters()
    {
        $accepted = $this->reservation();
        $rejected = $this->reservation();

        $this->cancelWith($accepted, ['reason' => str_repeat('a', 200)])->assertOk();
        $this->assertRejected(
            $this->cancelWith($rejected, ['reason' => str_repeat('a', 201)]),
            $rejected,
            CancelReservationAsTenantRequest::REASON_MAX_MESSAGE,
        );
    }

    public function test_length_counts_characters_not_bytes()
    {
        $short = $this->reservation();
        $long = $this->reservation();
        $tooLong = $this->reservation();

        $this->cancelWith($short, ['reason' => 'áéíóúñÁÉÍÓ'])->assertOk();
        $this->cancelWith($long, ['reason' => str_repeat('é', 200)])->assertOk();
        $this->assertRejected(
            $this->cancelWith($tooLong, ['reason' => str_repeat('é', 201)]),
            $tooLong,
            CancelReservationAsTenantRequest::REASON_MAX_MESSAGE,
        );
    }

    public function test_a_non_string_reason_is_rejected()
    {
        $reservation = $this->reservation();

        $this->assertRejected(
            $this->cancelWith($reservation, ['reason' => ['1234567890']]),
            $reservation,
            CancelReservationAsTenantRequest::REASON_MIN_MESSAGE,
        );
    }

    public function test_a_personal_reservation_keeps_the_reason_optional()
    {
        $withoutReason = $this->reservation(false);
        $shortReason = $this->reservation(false);

        $this->cancelWith($withoutReason, [], $this->creator)->assertOk();
        $this->cancelWith($shortReason, ['reason' => 'abc'], $this->creator)->assertOk();

        $this->assertDatabaseHas('reservations', ['id' => $withoutReason->id, 'status' => 'canceled', 'cancelation_reason' => null]);
        $this->assertDatabaseHas('reservations', ['id' => $shortReason->id, 'status' => 'canceled', 'cancelation_reason' => 'abc']);
    }
}
