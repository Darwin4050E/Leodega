<?php

namespace App\Notifications;

use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class ResetPasswordNotification extends Notification
{
    use Queueable;

    protected $url;

    public function __construct($token, $email)
    {
        $this->url = 'http://localhost:5173/reset-password?token='.$token.'&email='.$email;
    }

    public function via($notifiable)
    {
        unset($notifiable);

        return ['mail'];
    }

    public function toMail($notifiable)
    {
        return (new MailMessage)
            ->subject('Restablecer contraseña - Leodega')
            ->greeting('¡Hola '.$notifiable->name.'!')
            ->line('Recibiste este correo porque solicitaste restablecer tu contraseña.')
            ->action('Restablecer contraseña', $this->url)
            ->line('Si no solicitaste este cambio, puedes ignorar este mensaje.')
            ->line('Gracias por usar Leodega.');
    }

    public function toArray($notifiable)
    {
        return [
            'user_id' => $notifiable->id,
            'user_name' => $notifiable->name,
            'user_email' => $notifiable->email,
            'message' => 'Solicitud de restablecimiento de contraseña',
            'url' => $this->url,
        ];
    }
}
