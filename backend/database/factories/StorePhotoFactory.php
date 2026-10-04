<?php

namespace Database\Factories;

use App\Models\StorePhoto;
use App\Models\StoreRooms;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends \Illuminate\Database\Eloquent\Factories\Factory<\App\Models\StorePhoto>
 */
class StorePhotoFactory extends Factory
{
    protected $model = StorePhoto::class;

    public function definition(): array
    {
        return [
            'store_room_id' => StoreRooms::factory(),
            'photo_url' => 'store_photos/'.fake()->unique()->uuid().'.jpg',
        ];
    }
}
