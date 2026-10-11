<?php

namespace Database\Factories;

use App\Enums\InvitationStatus;
use App\Models\Organization;
use App\Models\OrganizationInvitation;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends \Illuminate\Database\Eloquent\Factories\Factory<\App\Models\OrganizationInvitation>
 */
class OrganizationInvitationFactory extends Factory
{
    protected $model = OrganizationInvitation::class;

    public function definition(): array
    {
        $invitee = User::factory()->create(['role' => 'tenant']);

        return [
            'organization_id' => Organization::factory(),
            'invited_user_id' => $invitee->id,
            'invited_by_user_id' => null,
            'email' => strtolower($invitee->email),
            'status' => InvitationStatus::Pending,
            'expires_at' => now()->addDays(OrganizationInvitation::EXPIRY_DAYS),
            'responded_at' => null,
        ];
    }

    public function accepted(): static
    {
        return $this->state(fn () => ['status' => InvitationStatus::Accepted, 'responded_at' => now()]);
    }

    public function rejected(): static
    {
        return $this->state(fn () => ['status' => InvitationStatus::Rejected, 'responded_at' => now()]);
    }

    public function cancelled(): static
    {
        return $this->state(fn () => ['status' => InvitationStatus::Cancelled]);
    }

    /**
     * Persisted `expired` status (an invite already replaced this row).
     */
    public function expired(): static
    {
        return $this->state(fn () => [
            'status' => InvitationStatus::Expired,
            'expires_at' => now()->subDay(),
        ]);
    }

    /**
     * Stored `pending` past `expires_at`: effectively expired but not yet
     * persisted as such.
     */
    public function lapsed(): static
    {
        return $this->state(fn () => ['expires_at' => now()->subDay()]);
    }
}
