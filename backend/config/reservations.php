<?php

return [
    /*
     * Penalty rate charged to the gestor when they cancel a paid, not-yet-
     * started reservation (HUG-06). Snapshotted onto each
     * reservation_cancellation_obligations row at write time, so changing
     * this value never rewrites the amount owed on a past cancellation.
     */
    'gestor_cancellation_penalty_rate' => 0.15,
];
