<?php

namespace App\Http\Resources;

use App\Support\Money;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * One reservation row of the panel table (hue-03 PAN-7). Wraps the plain
 * array built by OrganizationPanelService::reservations(); dates leave as
 * Y-m-d, money as a 2-decimal string, and a missing warehouse or creator
 * stays null instead of failing the page. No cancel or permission flag: the
 * panel is read-only.
 */
class PanelReservationResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->resource['id'],
            'warehouse_name' => $this->resource['warehouse_name'],
            'member_name' => $this->resource['member_name'],
            'start_date' => Carbon::parse($this->resource['start_date'])->toDateString(),
            'end_date' => Carbon::parse($this->resource['end_date'])->toDateString(),
            'status' => $this->resource['status'],
            'total' => Money::fromCents(Money::toCents($this->resource['total_mount'])),
            'paid_with_wallet' => $this->resource['paid_with_wallet'],
        ];
    }
}
