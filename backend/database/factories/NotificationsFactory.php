<?php

namespace Database\Factories;

use App\Models\Notifications;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

class NotificationsFactory extends Factory
{
    protected $model = Notifications::class;

    public function definition(): array
    {
        return [
            'sender_id' => User::factory(),
            'receiver_id' => User::factory(),
            'type' => 'TEST',
            'title' => $this->faker->sentence,
            'body' => $this->faker->paragraph,
            'data' => [],
            'is_read' => false,
        ];
    }
}
