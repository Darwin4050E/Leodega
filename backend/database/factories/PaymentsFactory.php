<?php

namespace Database\Factories;

use App\Models\Payments;
use App\Models\Reservations;
use Illuminate\Database\Eloquent\Factories\Factory;

class PaymentsFactory extends Factory
{
    protected $model = Payments::class;

    public function definition(): array
    {
        return [
            'reservation_id' => Reservations::factory(),
            'payment_method' => 'credit card',
            'payment_state' => 'pending',
            'payment_date' => now()->toDateString(),
        ];
    }
}
