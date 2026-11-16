<?php

namespace Tests\Feature;

use App\Models\Reservations;
use App\Models\StoreRooms;
use App\Models\User;
use App\Notifications\OrganizationReservationCancelledNotification;
use App\Services\OrganizationCancellationNotifier;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Notification;
use RuntimeException;
use Tests\Concerns\BuildsOrganizationCancellationScenario;
use Tests\TestCase;

/**
 * HUE-06 U1b OR-25: after an admin cancel commits, the creator gets an
 * org-aware email. A mail failure never undoes the cancellation.
 */
class OrganizationCancellationEmailTest extends TestCase
{
    use BuildsOrganizationCancellationScenario;
    use RefreshDatabase;

    private const REASON = 'Cambio de planes internos';

    protected function setUp(): void
    {
        parent::setUp();

        Notification::fake();
        $this->buildScenario();
    }

    private function sentMail(User $to): MailMessage
    {
        $mail = null;
        Notification::assertSentToTimes($to, OrganizationReservationCancelledNotification::class, 1);
        Notification::assertSentTo($to, OrganizationReservationCancelledNotification::class, function ($notification) use ($to, &$mail) {
            $mail = $notification->toMail($to);

            return true;
        });

        return $mail;
    }

    public function test_the_creator_gets_the_org_aware_email_with_the_breakdown()
    {
        $reservation = $this->paidReservation('100.00', 'moderada');

        $this->cancel($reservation, $this->admin, self::REASON)->assertOk();

        $mail = $this->sentMail($this->creator);
        $title = $reservation->storeRooms->title;
        $this->assertSame("Tu reserva de {$title} fue cancelada por un administrador de Andina", $mail->subject);
        $this->assertSame("Hola {$this->creator->name},", $mail->greeting);
        $this->assertSame([
            "{$this->admin->name}, administrador de Andina (RUC 1790011111001), canceló la reserva de {$title} del {$reservation->start_date} al {$reservation->end_date}.",
            'Motivo: '.self::REASON,
            'Total pagado: $100.00',
            'Penalización: $50.00',
            'Reembolso: $50.00 (acreditado al saldo de Andina)',
        ], $mail->introLines);
    }

    public function test_a_creator_who_is_the_acting_admin_still_gets_the_email()
    {
        $reservation = $this->paidReservation('100.00', 'moderada', ['tenant_id' => $this->admin->tenant->id]);

        $this->cancel($reservation, $this->admin, self::REASON)->assertOk();

        $this->sentMail($this->admin);
    }

    public function test_a_zero_refund_shows_the_no_refund_line_instead_of_the_destination()
    {
        $reservation = $this->paidReservation('100.00', 'estricta');

        $this->cancel($reservation, $this->admin, self::REASON)->assertOk();

        $lines = $this->sentMail($this->creator)->introLines;
        $this->assertSame('Total pagado: $100.00', $lines[2]);
        $this->assertSame('Penalización: $100.00', $lines[3]);
        $this->assertSame('Esta cancelación no genera reembolso.', $lines[4]);
        $this->assertCount(5, $lines);
    }

    public function test_an_unpaid_legacy_pending_reservation_reports_nothing_paid()
    {
        $reservation = $this->paidReservation('100.00', 'moderada', ['status' => 'pending']);
        $reservation->payments()->delete();

        $this->cancel($reservation, $this->admin, self::REASON)->assertOk();

        $lines = $this->sentMail($this->creator)->introLines;
        $this->assertSame('Total pagado: $0.00', $lines[2]);
        $this->assertSame('Penalización: $0.00', $lines[3]);
        $this->assertSame('Esta cancelación no genera reembolso.', $lines[4]);
    }

    public function test_the_email_is_still_sent_when_the_creator_left_the_organization()
    {
        $reservation = $this->paidReservation();
        $this->organization->users()->detach($this->creator->id);

        $this->cancel($reservation, $this->admin, self::REASON)->assertOk();

        $this->sentMail($this->creator);
    }

    public function test_a_mail_failure_does_not_undo_the_cancellation()
    {
        Log::spy();
        $reservation = $this->paidReservation();
        $this->app->bind(OrganizationCancellationNotifier::class, fn () => new class extends OrganizationCancellationNotifier
        {
            public function emailCreator(Reservations $reservation, int $actorId): void
            {
                throw new RuntimeException('smtp down');
            }
        });

        $this->cancel($reservation, $this->admin, self::REASON)->assertOk();

        $this->assertSame('canceled', $reservation->fresh()->status);
        $this->assertSame('950.00', $this->organization->fresh()->wallet_balance);
        $this->assertDatabaseHas('notifications', ['receiver_id' => $this->creator->id]);
        Log::shouldHaveReceived('error')->once();
    }

    public function test_a_rejected_cancel_sends_no_email()
    {
        $reservation = $this->paidReservation();
        $ineligible = $this->paidReservation('100.00', 'moderada', ['start_date' => now()->toDateString()]);

        $this->cancel($reservation, $this->creator, self::REASON)->assertStatus(403);
        $this->cancel($reservation, $this->admin, 'corto')->assertStatus(422);
        $this->cancel($ineligible, $this->admin, self::REASON)->assertStatus(409);

        Notification::assertNothingSent();
    }

    public function test_a_personal_cancel_sends_no_cancellation_email()
    {
        $personal = Reservations::factory()->create([
            'store_room_id' => StoreRooms::factory()->approved()->create()->id,
            'tenant_id' => $this->creator->tenant->id,
            'status' => 'confirmed',
            'start_date' => now()->addDays(10)->toDateString(),
            'end_date' => now()->addDays(40)->toDateString(),
            'total_mount' => '100.00',
            'cancellation_policy_tier' => 'flexible',
        ]);

        $this->cancel($personal, $this->creator, null)->assertOk();

        Notification::assertNothingSent();
    }
}
