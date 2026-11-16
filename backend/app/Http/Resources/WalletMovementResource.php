<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * One wallet ledger row. `amount` is signed (debits negative) and both money
 * fields are 2-decimal strings. Expects the `user` relation to be loaded.
 */
class WalletMovementResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'type' => $this->type->value,
            'amount' => $this->amount,
            'balance_after' => $this->balance_after,
            'reservation_id' => $this->reservation_id,
            'actor_name' => $this->user?->name,
            'created_at' => $this->created_at,
        ];
    }
}
