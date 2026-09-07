<?php

namespace App\Services;

use App\Exceptions\AccountBlockedException;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

class AuthService
{
    /**
     * Mensaje exacto (HUA-03, AC2) con el que se rechaza el login de una cuenta
     * bloqueada. Es idéntico tanto si la contraseña es correcta como si no, para
     * no filtrar la validez de las credenciales.
     */
    public const BLOCKED_ACCOUNT_MESSAGE = 'Tu cuenta ha sido suspendida. Contacta a soporte para más información';

    /**
     * Corrección de inconsistencia (ver PLAN_CORRECCION_INCONSISTENCIAS.md,
     * Fase 1.2): antes, login() solo llamaba a Auth::attempt(), sin verificar
     * User.state. Una cuenta bloqueada podía iniciar sesión con normalidad.
     *
     * Alcance deliberadamente acotado: solo rechaza 'blocked'. No se toca el
     * significado de 'pending' (ni el default de la migración) porque eso es
     * parte del diseño de HUA-03 (Sprint 1 del Sprint Backlog), que todavía
     * no se ha planificado en detalle.
     *
     * @throws AccountBlockedException si la cuenta está bloqueada.
     */
    public function ensureUserIsNotBlocked(User $user): void
    {
        if ($user->state === 'blocked') {
            throw new AccountBlockedException(self::BLOCKED_ACCOUNT_MESSAGE);
        }
    }

    /**
     * Extraído de AuthController: este bloque vivía duplicado de forma
     * idéntica en login() y register(). Crea el token de acceso y, si es
     * posible, guarda IP/user-agent en el token recién creado. Un fallo al
     * guardar esa metadata se registra en el log pero no impide continuar
     * (mismo comportamiento que antes).
     */
    public function issueTokenFor(User $user, Request $request): string
    {
        $tokenResult = $user->createToken('auth_token');
        $token = $tokenResult->plainTextToken;

        try {
            $latestToken = $user->tokens()->latest('id')->first();
            if ($latestToken) {
                $latestToken->ip_address = $request->ip();
                $latestToken->user_agent = $request->userAgent();
                $latestToken->save();
            }
        } catch (\Throwable $e) {
            Log::warning('No se pudo guardar metadata del token', [
                'error' => $e->getMessage(),
            ]);
        }

        return $token;
    }
}
