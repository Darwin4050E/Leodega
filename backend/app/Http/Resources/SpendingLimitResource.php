<?php

namespace App\Http\Resources;

use App\Services\SpendingLimitService;
use App\Support\Money;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * One member row of the spending-limit list (ML-13). Wraps the plain array
 * built by SpendingLimitService::rowsFor(); both money fields leave as
 * 2-decimal strings, the limit as null when the member is unlimited.
 */
class SpendingLimitResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'user_id' => $this->resource['user_id'],
            'name' => $this->resource['name'],
            'role' => $this->resource['role'],
            'monthly_limit' => SpendingLimitService::formatLimit($this->resource['monthly_limit']),
            'spent' => Money::fromCents($this->resource['spent_cents']),
        ];
    }
}
