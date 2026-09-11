<?php

namespace App\Services;

/**
 * Readonly input DTO for StoreModerationService::moderate(), replacing
 * positional-parameter growth (design decision #3): both call sites build
 * this with named arguments, removing the transposition risk between two
 * adjacent nullable string parameters ($reason/$reasonCode).
 */
final class ModerationDecision
{
    public function __construct(
        public readonly string $decision,
        public readonly ?string $reason = null,
        public readonly ?string $reasonCode = null,
        public readonly ?int $adminId = null,
        public readonly bool $permitWaiverAcknowledged = false,
    ) {}
}
