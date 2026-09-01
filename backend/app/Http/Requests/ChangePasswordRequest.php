<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class ChangePasswordRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'actual_p' => ['required'],
            'new_p' => ['required', 'min:8'],
            'new_p_c' => ['required', 'same:new_p'],
        ];
    }

    public function messages(): array
    {
        return [
            'actual_p.required' => 'La contraseña actual es obligatoria.',
            'new_p.required' => 'La nueva contraseña es obligatoria.',
            'new_p.min' => 'La nueva contraseña debe tener al menos 8 caracteres.',
            'new_p_c.required' => 'Debes confirmar la nueva contraseña.',
            'new_p_c.same' => 'Las contraseñas no coinciden.',
        ];
    }
}
