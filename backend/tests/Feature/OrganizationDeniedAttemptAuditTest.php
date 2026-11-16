<?php

namespace Tests\Feature;

use App\Enums\OrganizationRole;
use App\Enums\ReservationEventKind;
use App\Models\Organization;
use App\Models\OrganizationReservationEvent;
use App\Models\Reservations;
use App\Models\StoreRooms;
use App\Models\User;
use App\Services\OrganizationReservationEventService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Notification;
use Illuminate\Testing\TestResponse;
use RuntimeException;
use Tests\Concerns\BuildsOrganizationCancellationScenario;
use Tests\TestCase;

/**
 * HUE-06 U1b OR-23: a member of the organization who is not an admin and
 * tries to cancel or preview its reservation is refused with the standard 403
 * and leaves one `denied_attempt` row. Nobody else is audited.
 */
class OrganizationDeniedAttemptAuditTest extends TestCase
{
    use BuildsOrganizationCancellationScenario;
    use RefreshDatabase;

    private Reservations $reservation;

    protected function setUp(): void
    {
        parent::setUp();

        Notification::fake();
        $this->buildScenario();
        $this->reservation = $this->paidReservation();
    }

    private function deniedAttempts(): \Illuminate\Database\Eloquent\Collection
    {
        return OrganizationReservationEvent::where('kind', ReservationEventKind::DeniedAttempt->value)->get();
    }

    private function assertStandardDenial(TestResponse $response): void
    {
        $response->assertStatus(403);
        $this->assertSame(['message' => 'No autorizado'], $response->json());
    }

    public function test_a_member_cancel_attempt_is_refused_and_audited_with_its_action()
    {
        $this->assertStandardDenial($this->cancel($this->reservation, $this->creator));

        $attempt = $this->deniedAttempts()->sole();
        $this->assertSame($this->organization->id, $attempt->organization_id);
        $this->assertSame($this->reservation->id, $attempt->reservation_id);
        $this->assertSame($this->creator->id, $attempt->actor_user_id);
        $this->assertSame('cancel', $attempt->attempted_action);
        $this->assertNull($attempt->reason);
    }

    public function test_a_member_preview_attempt_is_refused_and_audited_with_its_action()
    {
        $this->assertStandardDenial($this->preview($this->reservation, $this->otherMember));

        $attempt = $this->deniedAttempts()->sole();
        $this->assertSame($this->otherMember->id, $attempt->actor_user_id);
        $this->assertSame('preview', $attempt->attempted_action);
    }

    public function test_repeated_attempts_are_not_deduplicated()
    {
        $this->cancel($this->reservation, $this->creator);
        $this->cancel($this->reservation, $this->creator);

        $this->assertCount(2, $this->deniedAttempts());
    }

    public function test_an_admin_of_another_organization_is_refused_without_an_audit_row()
    {
        $outsider = $this->tenantUser();
        Organization::factory()->withMember($outsider, OrganizationRole::ADMIN)->create();

        $this->assertStandardDenial($this->cancel($this->reservation, $outsider));
        $this->assertStandardDenial($this->preview($this->reservation, $outsider));

        $this->assertCount(0, $this->deniedAttempts());
    }

    public function test_a_non_member_and_a_landlord_leave_no_audit_row()
    {
        $this->assertStandardDenial($this->cancel($this->reservation, $this->tenantUser()));
        $this->assertStandardDenial($this->cancel($this->reservation, $this->gestor));

        $this->assertCount(0, $this->deniedAttempts());
    }

    public function test_an_anonymous_caller_is_a_401_without_an_audit_row()
    {
        $this->patchJson("/api/tenant/reservations/{$this->reservation->id}/cancel", [])->assertStatus(401);

        $this->assertCount(0, $this->deniedAttempts());
    }

    public function test_a_denied_personal_reservation_attempt_leaves_no_audit_row()
    {
        $personal = Reservations::factory()->create([
            'store_room_id' => StoreRooms::factory()->approved()->create()->id,
            'tenant_id' => $this->creator->tenant->id,
            'status' => 'confirmed',
            'start_date' => now()->addDays(10)->toDateString(),
            'end_date' => now()->addDays(40)->toDateString(),
        ]);

        $this->assertStandardDenial($this->cancel($personal, $this->otherMember));

        $this->assertCount(0, $this->deniedAttempts());
    }

    public function test_a_nonexistent_reservation_is_a_404_without_an_audit_row()
    {
        $this->actingAs($this->creator, 'sanctum')
            ->patchJson('/api/tenant/reservations/999999/cancel', [])
            ->assertStatus(404);

        $this->assertCount(0, $this->deniedAttempts());
    }

    public function test_members_and_non_members_get_the_identical_denial_body()
    {
        $member = $this->cancel($this->reservation, $this->creator);
        $nonMember = $this->cancel($this->reservation, $this->tenantUser());

        $this->assertSame($nonMember->json(), $member->json());
        $this->assertSame(['message'], array_keys($member->json()));
    }

    public function test_a_member_attempt_with_an_invalid_body_is_still_refused_and_audited()
    {
        $this->assertStandardDenial($this->cancel($this->reservation, $this->creator, 'x'));
        $this->assertStandardDenial($this->cancel($this->reservation, $this->creator, null));

        $this->assertCount(2, $this->deniedAttempts());
    }

    public function test_an_admin_is_never_audited()
    {
        $this->preview($this->reservation, $this->admin)->assertOk();
        $this->cancel($this->reservation, $this->admin)->assertOk();

        $this->assertCount(0, $this->deniedAttempts());
    }

    public function test_a_member_attempt_on_an_inactive_organization_is_audited()
    {
        $this->organization->update(['status' => 'inactive']);

        $this->assertStandardDenial($this->cancel($this->reservation, $this->creator));

        $this->assertCount(1, $this->deniedAttempts());
    }

    public function test_a_failing_audit_write_still_returns_the_standard_denial_and_is_logged()
    {
        Log::spy();
        $this->app->bind(OrganizationReservationEventService::class, fn () => new class extends OrganizationReservationEventService
        {
            public function recordDeniedAttempt(Reservations $reservation, User $actor, string $action): ?OrganizationReservationEvent
            {
                throw new RuntimeException('audit insert failed');
            }
        });

        $this->assertStandardDenial($this->cancel($this->reservation, $this->creator));

        Log::shouldHaveReceived('error')->once();
        $this->assertSame('confirmed', $this->reservation->fresh()->status);
    }
}
