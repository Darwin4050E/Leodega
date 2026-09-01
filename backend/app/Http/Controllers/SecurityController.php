<?php

namespace App\Http\Controllers;

use App\Http\Requests\ChangePasswordRequest;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;

class SecurityController extends Controller
{
    public function changePassword(ChangePasswordRequest $request)
    {
        $user = $request->user();
        $data = $request->validated();

        if (! Hash::check($data['actual_p'], $user->password)) {
            throw ValidationException::withMessages([
                'actual_p' => ['La contraseña actual no es correcta'],
            ]);
        }

        $user->password = Hash::make($data['new_p']);
        $user->save();

        return response()->json(['message' => 'Contraseña actualizada']);
    }
}
