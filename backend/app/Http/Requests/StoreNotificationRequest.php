<?php

namespace App\Http\Requests;

use App\Enums\NotificationType;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rules\Enum;

class StoreNotificationRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'receiver_id' => 'required|exists:user,id',
            'type' => ['required', new Enum(NotificationType::class)],
            'title' => 'required|string|max:100',
            'body' => 'nullable|string',
            'data' => 'nullable|array',
        ];
    }
}
