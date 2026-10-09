<?php

namespace App\Support;

use App\Models\Reservations;

/**
 * sdd/huc05-payment-receipt: single source of the tenant payment receipt,
 * shared by the tenantIndex `receipt` payload and the PDF view. Pure and
 * static, like ReservationCode and CancellationRefundCalculator.
 */
class ReservationReceipt
{
    private const DISPLAY_TIMEZONE = 'America/Guayaquil';

    private const STATUS_LABEL = 'CONFIRMADA';

    private const METHOD_LABELS = [
        'credit card' => 'Tarjeta de crédito',
        'debit card' => 'Tarjeta de débito',
    ];

    public static function build(Reservations $reservation): ?array
    {
        $reservation->loadMissing(['storeRooms.landlord.user', 'payments', 'organization']);

        $payment = $reservation->latestPaidPayment();

        if ($reservation->status !== 'confirmed' || $payment === null) {
            return null;
        }

        $paidAt = $payment->created_at->copy()->setTimezone(self::DISPLAY_TIMEZONE)->locale('es');

        $user = $reservation->storeRooms?->landlord?->user;

        return [
            'code' => ReservationCode::format($reservation->id),
            'status_label' => self::STATUS_LABEL,
            'store_room_title' => $reservation->storeRooms?->title,
            'gestor_name' => $user ? trim($user->name.' '.$user->lastname) : null,
            'start_date' => (string) $reservation->start_date,
            'end_date' => (string) $reservation->end_date,
            'total_paid' => number_format((float) $reservation->total_mount, 2, '.', ''),
            'payment_id' => $payment->id,
            'payment_method' => $payment->payment_method,
            'payment_method_label' => self::METHOD_LABELS[$payment->payment_method] ?? null,
            'paid_at' => $paidAt->toIso8601String(),
            'paid_at_label' => $paidAt->format('j').' '.$paidAt->shortMonthName.' '.$paidAt->format('Y, H:i'),
            // HUE-05 OR-10/D5: null for a personal reservation, live org
            // name/RUC (never a snapshot) for an organization reservation.
            'organization_name' => $reservation->organization?->name,
            'organization_ruc' => $reservation->organization?->ruc,
        ];
    }
}
