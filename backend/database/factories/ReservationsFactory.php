<?php

namespace Database\Factories;

use App\Models\Organization;
use App\Models\StoreRooms;
use App\Models\Tenants;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends \Illuminate\Database\Eloquent\Factories\Factory<\App\Models\Reservations>
 */
class ReservationsFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition()
    {
        return [
            'store_room_id' => StoreRooms::factory(),
            'tenant_id' => Tenants::factory(),
            'start_date' => now()->addDays(1),
            'end_date' => now()->addDays(5),
            'status' => 'confirmed',
            'total_mount' => 100,
            'rent_subtotal' => 80,
            'cancelation_reason' => null,
            'creation_date' => now(),
        ];
    }

    /**
     * HUE-05 D4: attaches the reservation to an organization (creator stays
     * `tenant_id`). Pass an existing `Organization` to reuse one across
     * several reservations in the same org, otherwise a fresh one is made.
     */
    public function forOrganization(?Organization $organization = null): static
    {
        return $this->state(fn () => [
            'organization_id' => ($organization ?? Organization::factory()->create())->id,
        ]);
    }
}
