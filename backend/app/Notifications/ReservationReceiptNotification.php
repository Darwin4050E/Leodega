<?php

namespace App\Notifications;

use App\Models\Reservations;
use App\Support\ReservationCode;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/**
 * Sent to the tenant once ReservationService::confirm() (invoked from
 * PaymentService::process()) marks a reservation as confirmed. Uses stored
 * reservation values only (total_mount) — amounts are never recomputed
 * here, per the spec's "Content sourced from stored values" requirement.
 *
 * Deliberately does NOT implement ShouldQueue: backend/Procfile defines
 * only a `web:` process, so a queued notification would never be consumed
 * by a worker and would be delivered late or not at all. The Queueable
 * trait is kept only for idiom parity with ResetPasswordNotification.
 */
class ReservationReceiptNotification extends Notification
{
    use Queueable;

    public function __construct(private Reservations $reservation) {}

    public function via($notifiable)
    {
        unset($notifiable);

        return ['mail'];
    }

    public function toMail($notifiable)
    {
        unset($notifiable);

        $tenantName = $this->reservation->tenants->user->name;
        $code = ReservationCode::format($this->reservation->id);
        $storeRoomTitle = $this->reservation->storeRooms->title;
        $amount = '$'.number_format((float) $this->reservation->total_mount, 2, '.', ',');

        return (new MailMessage)
            ->subject('Confirmación de tu reserva - Leodega')
            ->greeting('Hola, '.$tenantName.'.')
            ->line('Tu reserva ha sido confirmada y el pago fue procesado correctamente.')
            ->line('Código de reserva: '.$code)
            ->line('Almacén: '.$storeRoomTitle)
            ->line('Período: '.$this->reservation->start_date.' – '.$this->reservation->end_date)
            ->line('Monto pagado: '.$amount)
            ->line('Gracias por confiar en Leodega.');
    }
}
