<?php

namespace App\Http\Requests;

/**
 * Bolsa de reglas, no FormRequest — mismo motivo que UpdateUserRequest /
 * StoreAdminRequest: AccountModerationController valida con
 * $request->validate((new BlockUserRequest)->rules()) para conservar el
 * contrato 422 estándar de Laravel.
 *
 * `regex:/\S/` obliga a que la razón tenga al menos un carácter no en blanco,
 * de modo que "   " no cuente como razón válida.
 */
class BlockUserRequest
{
    public function rules(): array
    {
        return [
            'reason' => ['required', 'string', 'min:5', 'max:500', 'regex:/\S/'],
        ];
    }
}
