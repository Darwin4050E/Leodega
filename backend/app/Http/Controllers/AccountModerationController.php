<?php

namespace App\Http\Controllers;

use App\Exceptions\AccountModerationException;
use App\Http\Requests\BlockUserRequest;
use App\Models\User;
use App\Services\AccountModerationService;
use Illuminate\Http\Request;

/**
 * Endpoints semánticos de moderación de cuentas (HUA-03), en paralelo con
 * StoreModerationController. El gate `role:admin` vive en las rutas; los guards
 * de negocio (no auto-moderarse, no moderar a otro admin, acción redundante)
 * los aplica AccountModerationService.
 */
class AccountModerationController extends Controller
{
    public function block(Request $request, $id, AccountModerationService $service)
    {
        $target = User::findOrFail($id);
        $validated = $request->validate((new BlockUserRequest)->rules());

        try {
            $moderation = $service->block($target, $validated['reason'], (int) auth()->id());
        } catch (AccountModerationException $e) {
            return response()->json(['message' => $e->getMessage()], $e->statusCode);
        }

        return response()->json([
            'status' => 'success',
            'message' => 'Cuenta bloqueada',
            'user' => $target->fresh(),
            'moderation' => $moderation,
        ], 200);
    }

    public function reactivate($id, AccountModerationService $service)
    {
        $target = User::findOrFail($id);

        try {
            $moderation = $service->reactivate($target, (int) auth()->id());
        } catch (AccountModerationException $e) {
            return response()->json(['message' => $e->getMessage()], $e->statusCode);
        }

        return response()->json([
            'status' => 'success',
            'message' => 'Cuenta reactivada',
            'user' => $target->fresh(),
            'moderation' => $moderation,
        ], 200);
    }
}
