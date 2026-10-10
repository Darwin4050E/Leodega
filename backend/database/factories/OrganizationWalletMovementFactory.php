<?php

namespace Database\Factories;

use App\Enums\WalletMovementType;
use App\Models\Organization;
use App\Models\OrganizationWalletMovement;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * Raw ledger rows for tests. It does not touch `wallet_balance`; use
 * WalletService when balance and ledger must stay consistent.
 *
 * @extends \Illuminate\Database\Eloquent\Factories\Factory<\App\Models\OrganizationWalletMovement>
 */
class OrganizationWalletMovementFactory extends Factory
{
    protected $model = OrganizationWalletMovement::class;

    public function definition(): array
    {
        return [
            'organization_id' => Organization::factory(),
            'user_id' => null,
            'reservation_id' => null,
            'type' => WalletMovementType::Recarga,
            'amount' => '100.00',
            'balance_after' => '100.00',
        ];
    }
}
