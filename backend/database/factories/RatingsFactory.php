<?php

namespace Database\Factories;

use App\Models\Ratings;
use App\Models\StoreRooms;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

class RatingsFactory extends Factory
{
    protected $model = Ratings::class;

    public function definition(): array
    {
        return [
            'store_id' => StoreRooms::factory(),
            'user_id' => User::factory(),
            'stars' => $this->faker->numberBetween(1, 5),
            'comment' => $this->faker->sentence(),
        ];
    }
}
