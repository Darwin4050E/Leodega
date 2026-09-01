<?php

namespace Database\Factories;

use App\Models\Reports;
use App\Models\StoreRooms;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

class ReportsFactory extends Factory
{
    protected $model = Reports::class;

    public function definition(): array
    {
        return [
            'user_id' => User::factory(),
            'store_id' => StoreRooms::factory(),
            'reported_user_id' => null,
            'title' => $this->faker->sentence,
            'priority' => 'medium',
            'report_type' => 'store',
            'description' => $this->faker->paragraph(3),
            'status' => 'pending',
        ];
    }

    public function resolved()
    {
        return $this->state(fn () => [
            'status' => 'resolved',
        ]);
    }
}
