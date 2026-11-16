<?php

namespace App\Notifications;

use App\Models\Reservations;
use App\Models\User;
use App\Support\Money;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/**
 * HUE-06 OR-25: sent to the reservation creator after an organization admin
 * cancels it. Amounts come from the stored reservation; the penalty is derived
 * in integer cents and nothing counts as paid for a reservation without a
 * paid payment.
 *
 * Deliberately does NOT implement ShouldQueue, for the same reason as
 * ReservationCancellationNotification: backend/Procfile defines only a `web:`
 * process, so a queued notification would never be consumed by a worker.
 */
class OrganizationReservationCancelledNotification extends Notification
{
    use Queueable;

    public function __construct(private Reservations $reservation, private User $actor) {}

    public function via($notifiable)
    {
        unset($notifiable);

        return ['mail'];
    }

    public function toMail($notifiable)
    {
        unset($notifiable);

        $this->reservation->loadMissing(['organization', 'storeRooms', 'tenants.user', 'payments']);

        $organization = $this->reservation->organization;
        $title = $this->reservation->storeRooms->title;

        $refundCents = Money::toCents((string) ($this->reservation->refund_amount ?? '0.00'));
        $totalCents = $this->reservation->latestPaidPayment() !== null
            ? Money::toCents((string) $this->reservation->total_mount)
            : 0;

        $mail = (new MailMessage)
            ->subject("Tu reserva de {$title} fue cancelada por un administrador de {$organization->name}")
            ->greeting("Hola {$this->reservation->tenants->user->name},")
            ->line("{$this->actor->name}, administrador de {$organization->name} (RUC {$organization->ruc}), canceló la reserva de {$title} del {$this->reservation->start_date} al {$this->reservation->end_date}.")
            ->line("Motivo: {$this->reservation->cancelation_reason}")
            ->line('Total pagado: '.$this->money($totalCents))
            ->line('Penalización: '.$this->money($totalCents - $refundCents));

        return $refundCents > 0
            ? $mail->line('Reembolso: '.$this->money($refundCents)." (acreditado al saldo de {$organization->name})")
            : $mail->line('Esta cancelación no genera reembolso.');
    }

    private function money(int $cents): string
    {
        return '$'.number_format($cents / 100, 2, '.', ',');
    }
}
