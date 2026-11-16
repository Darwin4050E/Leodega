<?php

namespace App\Http\Resources;

use App\Support\Money;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * One row of the panel history feed (hue-03 PAN-8). Wraps the plain array
 * built by OrganizationHistoryService::page(); the instant leaves as ISO 8601
 * and money as a 2-decimal string. There is no email key: the actor is a
 * display name only.
 */
class HistoryEntryResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->resource['id'],
            'kind' => $this->resource['kind'],
            'occurred_at' => Carbon::parse($this->resource['occurred_at'])->toISOString(),
            'actor_name' => $this->resource['actor_name'],
            'target_label' => $this->resource['target_label'],
            'amount' => $this->resource['amount'] === null ? null : Money::fromCents(Money::toCents($this->resource['amount'])),
        ];
    }
}
