<?php

namespace App\Notifications;

use App\Models\Reservations;
use App\Support\ReservationCode;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/**
 * HUG-06: sent to the tenant once ReservationService::cancelByLandlord()
 * cancels a paid reservation. Uses stored reservation values only -- amounts
 * are never recomputed here, matching ReservationReceiptNotification.
 *
 * Deliberately does NOT implement ShouldQueue, for the same reason as
 * ReservationReceiptNotification: backend/Procfile defines only a `web:`
 * process, so a queued notification would never be consumed by a worker.
 */
class ReservationCancellationNotification extends Notification
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
        $refund = '$'.number_format((float) $this->reservation->total_mount, 2, '.', ',');

        return (new MailMessage)
            ->subject('Tu reserva fue cancelada - Leodega')
            ->greeting('Hola, '.$tenantName.'.')
            ->line('El gestor de "'.$storeRoomTitle.'" canceló tu reserva.')
            ->line('Código de reserva: '.$code)
            ->line('Período: '.$this->reservation->start_date.' – '.$this->reservation->end_date)
            ->line('Motivo: '.$this->reservation->cancelation_reason)
            ->line('Se procesará un reembolso de '.$refund.'.')
            ->line('Gracias por confiar en Leodega.');
    }
}
