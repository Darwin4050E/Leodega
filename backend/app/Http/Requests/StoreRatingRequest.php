<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class StoreRatingRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'store_id' => 'required|exists:storeRooms,id',
            'stars' => 'required|integer|between:1,5',
            'comment' => 'required|string',
        ];
    }
}
