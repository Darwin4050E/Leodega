<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

/**
 * sdd/tenant-self-cancel reconciliation #3: `reason` is optional, diverging
 * from the landlord path's `required|min:10` -- the prototype's tenant-cancel
 * modal (`ResCancelModal`) collects no reason text at all.
 */
class CancelReservationAsTenantRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'reason' => ['nullable', 'string'],
        ];
    }
}
