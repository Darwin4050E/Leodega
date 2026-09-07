<?php

namespace Database\Factories;

use App\Models\Landlords;
use App\Models\Reservations;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends \Illuminate\Database\Eloquent\Factories\Factory<\App\Models\ReservationCancellationObligation>
 */
class ReservationCancellationObligationFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition()
    {
        return [
            'reservation_id' => Reservations::factory(),
            'landlord_id' => Landlords::factory(),
            'refund_amount' => 4180,
            'penalty_amount' => 450,
            'penalty_rate' => 0.15,
            'reason' => 'El almacen sufrio un incendio',
            'settlement_status' => 'pending_settlement',
        ];
    }
}
