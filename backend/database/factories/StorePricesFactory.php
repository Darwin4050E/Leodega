<?php

namespace Database\Factories;

use App\Models\StoreRooms;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends \Illuminate\Database\Eloquent\Factories\Factory<\App\Models\StorePrices>
 */
class StorePricesFactory extends Factory
{
    public function definition(): array
    {
        return [
            'store_room_id' => StoreRooms::factory(),
            'mode' => 'month',
            'price' => 1000,
            'disponibility' => true,
        ];
    }
}
