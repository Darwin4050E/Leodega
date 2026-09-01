<?php

namespace App\Services;

use App\Enums\NotificationType;
use App\Models\Notifications;

class NotificationService
{
    public static function send(
        int $senderId,
        int $receiverId,
        NotificationType $type,
        string $title,
        ?string $body = null,
        array $data = []
    ): Notifications {
        return Notifications::create([
            'sender_id' => $senderId,
            'receiver_id' => $receiverId,
            'type' => $type->value,
            'title' => $title,
            'body' => $body,
            'data' => $data,
        ]);
    }
}
