<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreUserRequest;
use App\Http\Requests\UpdateUserRequest;
use App\Models\User;
use App\Services\UserRegistrationService;
use Illuminate\Http\Request;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;

class UserController extends ApiController
{
    // Admins get the full row; every other caller only gets the messaging-contact fields.
    public function index(Request $request)
    {
        if ($request->user()->role === 'admin') {
            return $this->indexModel(User::class);
        }

        return response()->json(User::query()->get(['id', 'name', 'lastname']), 200);
    }

    public function show(Request $request, $id)
    {
        if ($request->user()->role === 'admin') {
            return $this->showModel(User::class, $id);
        }

        $item = User::select(['id', 'name', 'lastname'])->find($id);
        if (! $item) {
            return response()->json(['message' => 'Item not found'], 404);
        }

        return response()->json($item, 200);
    }

    public function store(Request $request, UserRegistrationService $registrationService)
    {
        $rules = (new StoreUserRequest)->rules();

        // Endpoint público (alta de cuenta en Decision.tsx). Los administradores
        // se crean solo por POST /admin, por eso role=admin se rechaza siempre.
        if ($request->input('role') === 'admin') {
            return response()->json([
                'message' => 'No autorizado para crear un usuario con rol admin',
            ], 403);
        }

        // storeModel() creates related rows for every array key of the request, so
        // only validated keys travel on; registered accounts always start active.
        $payload = Arr::only($request->all(), array_keys($rules));
        $payload['state'] = 'active';
        $clean = Request::create('/', 'POST', $payload);

        return DB::transaction(function () use ($clean, $rules, $registrationService) {
            $response = $this->storeModel($clean, User::class, $rules);
            $data = $response->getData();

            if ($response->getStatusCode() === 201 && isset($data->item->id)) {
                $registrationService->createProfileForRole(User::findOrFail($data->item->id));
            }

            return $response;
        });
    }

    public function update(Request $request, $id)
    {
        return $this->updateModel($request, User::class, $id, (new UpdateUserRequest($id))->rules());
    }

    public function destroy($id)
    {
        return $this->destroyModel(User::class, $id);
    }

    public function destroySelf()
    {
        $authId = Auth::id();
        if (! $authId) {
            return response()->json(['message' => 'No autenticado'], 401);
        }

        DB::transaction(function () use ($authId) {

            DB::table('conversation_user')->where('user_id', $authId)->delete();
            DB::table('messages')->where('sender_id', $authId)->delete();
            DB::table('personal_access_tokens')
                ->where('tokenable_id', $authId)
                ->where('tokenable_type', User::class)
                ->delete();

            User::where('id', $authId)->delete();
        });

        return response()->json(['message' => 'Cuenta eliminada correctamente'], 200);
    }

    //
}
