<?php

return [
    /*
     * Penalty rate charged to the gestor when they cancel a paid, not-yet-
     * started reservation (HUG-06). Snapshotted onto each
     * reservation_cancellation_obligations row at write time, so changing
     * this value never rewrites the amount owed on a past cancellation.
     */
    'gestor_cancellation_penalty_rate' => 0.15,

    /*
     * sdd/hug02-payment-hold-expiry: minutes a `pending` reservation's
     * payment hold stays active before it is lazily expired. Blocks other
     * tenants' conflicting dates while active (Reservations::holdCutoff(),
     * scopeActiveHold/scopeExpiredHold, isExpiredHold()).
     */
    'payment_hold_minutes' => (int) env('PAYMENT_HOLD_MINUTES', 15),

    /*
     * sdd/hug02-payment-hold-expiry: a lazily-expired hold only notifies
     * the landlord when the elapsed time since expiry is within this
     * recency window (hours). Older stale rows are released silently --
     * avoids a deploy-time notification burst for pre-existing stale
     * `pending` rows.
     */
    'payment_hold_notify_recency_hours' => (int) env('PAYMENT_HOLD_NOTIFY_RECENCY_HOURS', 24),
];
