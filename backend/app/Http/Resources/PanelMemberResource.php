<?php

namespace App\Http\Resources;

use App\Services\SpendingLimitService;
use App\Support\Money;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * One member row of the panel (hue-03 PAN-6). Wraps the plain array built by
 * OrganizationPanelService::members(), which already left out every key the
 * caller may not see: this resource only formats what is there, so a hidden
 * key stays absent instead of turning into null. `monthly_limit` is the one
 * key where null is meaningful ("no limit"), and only when it is present.
 */
class PanelMemberResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $row = [
            'user_id' => $this->resource['user_id'],
            'name' => $this->resource['name'],
            'role' => $this->resource['role'],
            'joined_at' => isset($this->resource['joined_at']) ? Carbon::parse($this->resource['joined_at'])->toISOString() : null,
            'is_self' => $this->resource['is_self'],
        ];

        if (array_key_exists('email', $this->resource)) {
            $row['email'] = $this->resource['email'];
        }

        if (array_key_exists('spent_cents', $this->resource)) {
            $row['monthly_limit'] = SpendingLimitService::formatLimit($this->resource['monthly_limit']);
            $row['spent'] = Money::fromCents($this->resource['spent_cents']);
        }

        return $row;
    }
}
