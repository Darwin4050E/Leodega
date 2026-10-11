<?php

namespace App\Http\Requests\Concerns;

use Illuminate\Http\Exceptions\HttpResponseException;

/**
 * HUE-06 OR-13/OR-15: authorization of the tenant cancel and preview routes
 * runs in the FormRequest, so it precedes validation and a denied caller never
 * sees a 422. Every denial returns the same 403 body whatever the caller class,
 * so the existence of an organization is never revealed.
 */
trait AuthorizesTenantReservationCancellation
{
    public const DENIED_MESSAGE = 'No autorizado';

    public function authorize(): bool
    {
        return $this->user()->can('cancelAsTenant', $this->route('reservation'));
    }

    protected function failedAuthorization(): never
    {
        throw new HttpResponseException(response()->json(['message' => self::DENIED_MESSAGE], 403));
    }
}
