<?php

namespace Database\Factories;

use App\Enums\ReservationEventKind;
use App\Models\Organization;
use App\Models\OrganizationReservationEvent;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * Raw audit rows for tests; production rows come from
 * OrganizationReservationEventService.
 *
 * @extends \Illuminate\Database\Eloquent\Factories\Factory<\App\Models\OrganizationReservationEvent>
 */
class OrganizationReservationEventFactory extends Factory
{
    protected $model = OrganizationReservationEvent::class;

    public function definition(): array
    {
        return [
            'organization_id' => Organization::factory(),
            'reservation_id' => null,
            'actor_user_id' => null,
            'kind' => ReservationEventKind::Cancelled,
            'attempted_action' => null,
            'reason' => null,
        ];
    }

    public function cancelled(?string $reason = null): static
    {
        return $this->state(fn () => [
            'kind' => ReservationEventKind::Cancelled,
            'attempted_action' => null,
            'reason' => $reason,
        ]);
    }

    public function deniedAttempt(string $action = OrganizationReservationEvent::ACTION_CANCEL): static
    {
        return $this->state(fn () => [
            'kind' => ReservationEventKind::DeniedAttempt,
            'attempted_action' => $action,
            'reason' => null,
        ]);
    }
}
