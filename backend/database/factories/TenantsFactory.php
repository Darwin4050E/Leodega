<?php

namespace Database\Factories;

use App\Models\Tenants;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends \Illuminate\Database\Eloquent\Factories\Factory<\App\Models\Tenants>
 */
class TenantsFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    protected $model = Tenants::class;

    public function definition()
    {
        return [
            'user_id' => User::factory(),
            'search_preference' => 'price',
        ];
    }
}
