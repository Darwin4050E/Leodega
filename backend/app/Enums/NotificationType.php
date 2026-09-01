<?php

namespace App\Enums;

enum NotificationType: string
{
    //
    case MESSAGE = 'message';
    case RESERVATION_REQUEST = 'reservation_request';
    case RESERVATION_CONFIRMED = 'reservation_confirmed';
    case RESERVATION_CANCELED = 'reservation_canceled';
    case STORE_CREATED = 'store_created';
    case STORE_REPORTED = 'store_reported';
    case STORE_APPROVED = 'store_approved';
    case STORE_REJECTED = 'store_rejected';
}
