<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;

class SessionController extends Controller
{
    public function index(Request $request)
    {
        $user = $request->user();
        $currentToken = $user->currentAccessToken();

        $sessions = $user->tokens()
            ->orderByDesc('last_used_at')
            ->orderByDesc('created_at')
            ->get()
            ->map(function ($t) use ($currentToken) {
                return [
                    'id' => $t->id,
                    'name' => $t->name, // "auth_token"
                    'ip_address' => $t->ip_address,
                    'user_agent' => $t->user_agent,
                    'created_at' => optional($t->created_at)->toDateTimeString(),
                    'last_used_at' => optional($t->last_used_at)->toDateTimeString(),
                    'is_current' => $currentToken ? ($t->id === $currentToken->id) : false,
                ];
            });

        return response()->json(['sessions' => $sessions]);
    }

    public function destroy(Request $request, $tokenId)
    {
        $user = $request->user();
        $currentToken = $user->currentAccessToken();

        // para cerrar
        if ($currentToken && (int) $tokenId === $currentToken->id) {
            return response()->json([
                'message' => 'No puedes cerrar la sesión actual desde aquí.',
            ], 422);
        }

        $deleted = $user->tokens()->where('id', $tokenId)->delete();

        return response()->json([
            'message' => $deleted ? 'Sesión cerrada.' : 'Sesión no encontrada.',
        ]);
    }
}
