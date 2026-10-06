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
}
