<?php

namespace App\Http\Requests;

use App\Http\Requests\Concerns\AuthorizesTenantReservationCancellation;
use App\Models\OrganizationReservationEvent;
use Illuminate\Foundation\Http\FormRequest;

/**
 * sdd/tenant-self-cancel reconciliation #3: `reason` is optional for a
 * personal reservation, diverging from the landlord path's `required|min:10`.
 * HUE-06 makes it mandatory for an organization reservation (see rules()).
 */
class CancelReservationAsTenantRequest extends FormRequest
{
    use AuthorizesTenantReservationCancellation;

    public const REASON_MIN_MESSAGE = 'El motivo debe tener al menos 10 caracteres.';

    public const REASON_MAX_MESSAGE = 'El motivo no puede superar los 200 caracteres.';

    protected function attemptedAction(): string
    {
        return OrganizationReservationEvent::ACTION_CANCEL;
    }

    public function rules(): array
    {
        if ($this->route('reservation')->organization_id === null) {
            return ['reason' => ['nullable', 'string']];
        }

        return ['reason' => ['required', 'string', 'min:10', 'max:200']];
    }

    public function messages(): array
    {
        return [
            'reason.required' => self::REASON_MIN_MESSAGE,
            'reason.string' => self::REASON_MIN_MESSAGE,
            'reason.min' => self::REASON_MIN_MESSAGE,
            'reason.max' => self::REASON_MAX_MESSAGE,
        ];
    }
}
