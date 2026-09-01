<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class StoreReportRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'store_id' => 'required|exists:storeRooms,id',
            'title' => 'required|string|max:255',
            'report_type' => 'required|string|max:255',
            'priority' => 'required|in:low,medium,high',
            'description' => 'required|string|min:20',
            'files.*' => 'file|max:10240',
        ];
    }
}
