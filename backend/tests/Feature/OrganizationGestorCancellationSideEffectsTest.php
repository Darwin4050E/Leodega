<?php

namespace Tests\Feature;

use App\Enums\ReservationEventKind;
use App\Models\Notifications;
use App\Models\OrganizationReservationEvent;
use App\Notifications\OrganizationReservationCancelledNotification;
use App\Notifications\ReservationCancellationNotification;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Notification;
use Tests\Concerns\BuildsOrganizationCancellationScenario;
use Tests\TestCase;

/**
 * HUE-06 OR-S71: a gestor cancel of an organization reservation keeps the
 * existing gestor-worded creator email and adds no member fan-out, no event
 * and no org-aware admin email.
 */
class OrganizationGestorCancellationSideEffectsTest extends TestCase
{
    use BuildsOrganizationCancellationScenario;
    use RefreshDatabase;

    private const REASON = 'El almacen sufrio un incendio';

    protected function setUp(): void
    {
        parent::setUp();

        Notification::fake();
        $this->buildScenario();
    }

    public function test_or_s71_a_gestor_cancel_of_an_org_reservation_keeps_the_gestor_email_and_adds_no_member_side_effects()
    {
        $reservation = $this->paidReservation('100.00', 'moderada');

        $this->actingAs($this->gestor, 'sanctum')
            ->patchJson("/api/landlord/reservations/{$reservation->id}/cancel", ['reason' => self::REASON])
            ->assertOk();

        $this->assertSame('1000.00', $this->organization->fresh()->wallet_balance);

        Notification::assertSentToTimes($this->creator, ReservationCancellationNotification::class, 1);
        Notification::assertSentTo($this->creator, ReservationCancellationNotification::class, function ($notification) {
            $mail = $notification->toMail($this->creator);
            $title = $this->creator->tenant->reservations()->sole()->storeRooms->title;

            $this->assertSame('Tu reserva fue cancelada - Leodega', $mail->subject);
            $this->assertContains("El gestor de \"{$title}\" canceló tu reserva.", $mail->introLines);
            $this->assertContains('Motivo: '.self::REASON, $mail->introLines);

            return true;
        });
        Notification::assertNotSentTo($this->creator, OrganizationReservationCancelledNotification::class);
        Notification::assertNotSentTo($this->admin, OrganizationReservationCancelledNotification::class);
        Notification::assertNotSentTo($this->otherMember, OrganizationReservationCancelledNotification::class);
        Notification::assertNotSentTo($this->admin, ReservationCancellationNotification::class);
        Notification::assertNotSentTo($this->otherMember, ReservationCancellationNotification::class);

        $inApp = Notifications::sole();
        $this->assertSame($this->creator->id, $inApp->receiver_id);
        $this->assertSame($this->gestor->id, $inApp->sender_id);
        $this->assertSame(0, Notifications::whereIn('receiver_id', [$this->admin->id, $this->otherMember->id, $this->gestor->id])->count());

        $this->assertSame(0, OrganizationReservationEvent::where('kind', ReservationEventKind::Cancelled->value)->count());
        $this->assertSame(0, OrganizationReservationEvent::count());
    }
}
