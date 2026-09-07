<?php

namespace App\Http\Controllers;

use App\Http\Requests\RegisterRequest;
use App\Models\User;
use App\Services\AuthService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;

class AuthController extends Controller
{
    public function login(Request $request, AuthService $authService)
    {
        try {
            $request->validate([
                'email' => 'required|email',
                'password' => 'required',
            ]);

            // HUA-03 (D5): el veredicto de cuenta bloqueada se resuelve ANTES de
            // Auth::attempt, a partir de una búsqueda por email. Así la respuesta
            // es idéntica con contraseña correcta o incorrecta (AC2, no
            // enumeración) y nunca se autentica a un usuario bloqueado.
            $user = User::where('email', $request->email)
                ->with(['landlord:id,user_id,optional_company', 'tenant:id,user_id,search_preference'])
                ->first();

            if ($user && $user->state === 'blocked') {
                return response()->json([
                    'status' => 'error',
                    'message' => AuthService::BLOCKED_ACCOUNT_MESSAGE,
                ], 403);
            }

            // Autentica si existe un usuario en la bd con esas credenciales
            if (! Auth::attempt($request->only('email', 'password'))) {
                return response()->json([
                    'message' => 'Credenciales inválidas',
                ], 401);
            }

            $token = $authService->issueTokenFor($user, $request);

            return response()->json([
                'status' => 'success',
                'message' => 'Inicio de sesión exitoso',
                'user' => $user,
                'token' => $token,
                'token_type' => 'Bearer',
            ], 200);
        } catch (\Exception $e) {
            return response()->json([
                'status' => 'error',
                'message' => 'Error al iniciar sesión',
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    public function me(Request $request)
    {
        return response()->json([
            'user' => $request->user(),
        ]);
    }

    public function logout(Request $request)
    {
        $request->user()->currentAccessToken()->delete();

        return response()->json([
            'message' => 'Sesión cerrada correctamente',
        ], 200);
    }

    public function register(RegisterRequest $request, AuthService $authService)
    {
        $validated = $request->validated();

        $user = User::create([
            'name' => $validated['name'],
            'lastname' => $validated['lastname'],
            'phone' => $validated['phone'],
            'email' => $validated['email'],
            'password' => Hash::make($validated['password']),
        ]);
        // ya con token de acceso
        $token = $authService->issueTokenFor($user, $request);

        return response()->json([
            'status' => 'success',
            'message' => 'Usuario creado correctamente',
            'user' => $user,
            'token' => $token,
            'token_type' => 'Bearer',
        ], 201);
    }
}
