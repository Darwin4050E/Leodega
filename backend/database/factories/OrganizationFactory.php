<?php

namespace Database\Factories;

use App\Enums\OrganizationRole;
use App\Models\Organization;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends \Illuminate\Database\Eloquent\Factories\Factory<\App\Models\Organization>
 */
class OrganizationFactory extends Factory
{
    protected $model = Organization::class;

    public function definition(): array
    {
        return [
            'name' => fake()->company(),
            'ruc' => fake()->unique()->numerify('##########001'),
            'email' => fake()->safeEmail(),
            'logo_path' => null,
            // Explicit, not just relying on the DB column default: HUE-05
            // callers compare $organization->status in memory right after
            // factory creation (e.g. ReservationServiceTest), and an
            // unset attribute would read as null, not 'active'.
            'status' => 'active',
        ];
    }

    /**
     * Attaches the user to the organization once it is created. Chain it to
     * add several members; the role defaults to admin, the creator's role.
     */
    public function withMember(User $user, string|OrganizationRole $role = OrganizationRole::ADMIN): static
    {
        $role = $role instanceof OrganizationRole ? $role->value : $role;

        return $this->afterCreating(function (Organization $organization) use ($user, $role) {
            $organization->users()->attach($user->id, ['role' => $role]);
        });
    }

    /**
     * HUE-05 D11/OR-3: an organization whose `status` is not `active`, so
     * reservations against it must be rejected with a 422.
     */
    public function inactive(): static
    {
        return $this->state(fn () => ['status' => 'inactive']);
    }
}
