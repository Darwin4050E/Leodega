<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class UpdateReportStatusRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'status' => ['required', 'in:resolved,canceled'],
            'cancelation_reason' => ['nullable', 'string', 'max:1000'],
        ];
    }
}
