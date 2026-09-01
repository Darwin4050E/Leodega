<?php

namespace Database\Factories;

use App\Models\Landlords;
use App\Models\StoreRooms;
use Illuminate\Database\Eloquent\Factories\Factory;

class StoreRoomsFactory extends Factory
{
    protected $model = StoreRooms::class;

    public function definition(): array
    {
        return [
            'landlord_id' => Landlords::factory(),
            'room_type' => 'bodega',
            'storage_type' => 'completa',
            'direction' => fake()->streetAddress(),
            'city' => fake()->city(),
            'size' => fake()->randomFloat(2, 10, 200),
            'title' => fake()->sentence(3),
            'description' => fake()->paragraph(),
            'security' => 'Cámaras 24/7',
            'publication_status' => 'pending',
            'publication_date' => now(),
        ];
    }
}
