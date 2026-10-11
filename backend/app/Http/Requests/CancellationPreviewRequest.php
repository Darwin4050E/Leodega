<?php

namespace App\Http\Requests;

use App\Http\Requests\Concerns\AuthorizesTenantReservationCancellation;
use Illuminate\Foundation\Http\FormRequest;

/**
 * Carries no input: it exists so the preview route authorizes exactly like the
 * cancel route and returns the identical denied body.
 */
class CancellationPreviewRequest extends FormRequest
{
    use AuthorizesTenantReservationCancellation;

    public function rules(): array
    {
        return [];
    }
}
