<?php

namespace App\Http\Requests;

use App\Models\Organization;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * Role gating (tenant only) lives in the route's `role:tenant` middleware,
 * so authorize() is open. `status`, `created_by`, `role` and `logo_path` are
 * deliberately absent from rules(): they are server-owned and must never
 * reach validated(). Uses the native 422 {message, errors} shape (no legacy
 * `status` key).
 *
 * `logo` is optional; PNG/JPG only, content-sniffed by `mimes`, max 2 MB
 * (same ceiling as store photos). Squareness is a UI hint, not enforced.
 */
class StoreOrganizationRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'max:255'],
            // bail + string first: a non-string RUC (integer, array) must be a
            // 422, not a TypeError inside digits/unique, and a string keeps
            // leading zeros intact.
            'ruc' => ['bail', 'required', 'string', 'digits:13', 'ends_with:001', Rule::unique('organizations', 'ruc')],
            // max runs before email and bails: the email rule also rejects
            // anything past 254 characters, which would hide the max message.
            // `filter` adds PHP's stricter check so `a@b` (no dotted domain)
            // is rejected; plain RFC validation accepts it.
            'email' => ['bail', 'required', 'max:255', 'email:rfc,filter'],
            'logo' => ['nullable', 'bail', 'file', 'mimes:jpg,jpeg,png', 'max:2048'],
        ];
    }

    public function messages(): array
    {
        return [
            'name.required' => 'La razón social es obligatoria',
            'name.string' => 'La razón social no es válida',
            'name.max' => 'La razón social no puede superar 255 caracteres',
            'ruc.required' => 'El RUC es obligatorio',
            'ruc.string' => 'El RUC debe tener 13 dígitos',
            'ruc.digits' => 'El RUC debe tener 13 dígitos',
            'ruc.ends_with' => 'El RUC debe terminar en 001',
            'ruc.unique' => Organization::DUPLICATE_RUC_MESSAGE,
            'email.required' => 'Ingresa un correo válido para la organización',
            'email.email' => 'Ingresa un correo válido para la organización',
            'email.max' => 'El correo no puede superar 255 caracteres',
            'logo.file' => 'No se pudo cargar el logo. Intenta con otra imagen',
            'logo.mimes' => 'El logo debe ser una imagen PNG o JPG',
            'logo.max' => 'El logo no puede superar 2 MB',
        ];
    }
}
