<?php

namespace App\Http\Requests;

use App\Models\Landlords;
use Illuminate\Contracts\Validation\Validator;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Http\Exceptions\HttpResponseException;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\Unique;

/**
 * HUG-04: convertido de bolsa de reglas a FormRequest real para poder
 * reproducir el envelope legacy de error 400 ({message, errors, status})
 * en lugar del 422 por defecto de Laravel, y para poder validar el archivo
 * de permiso de bomberos (obligatorio) junto al resto de campos.
 *
 * `landlord_id` y `publication_status` se retiran de rules() a propósito:
 * ambos se derivan/forzan server-side (ver StoreRoomsController::store y
 * StoreRoomService::register) y nunca deben aceptarse desde el payload.
 */
class StoreStoreRoomRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'room_type' => 'required|in:habitacion,garaje,contenedor,sotano,atico,bodega',
            'storage_type' => 'required|in:completa,privado,compartido',
            'direction' => 'required|string',
            'city' => 'required|string',
            'size' => 'required|numeric',
            'title' => ['required', 'string', $this->uniqueTitlePerLandlord()],
            'description' => 'required|string',
            'security' => 'required|string',
            'firefighter_permit' => 'required|file|mimes:pdf,jpg,jpeg,png|max:5120',
            'cancellation_policy_tier' => 'required|in:flexible,moderada,estricta',
        ];
    }

    public function messages(): array
    {
        return [
            'title.unique' => 'Ya tienes una bodega publicada con ese nombre. Elige otro nombre para continuar.',
            'firefighter_permit.required' => 'Debe adjuntar el permiso de bomberos vigente para continuar.',
            'firefighter_permit.mimes' => 'El permiso debe ser un archivo PDF, JPG, JPEG o PNG.',
            'firefighter_permit.max' => 'El permiso no debe superar los 5 MB.',
        ];
    }

    /**
     * HUL-03 (escenario 3): un gestor no puede publicar dos bodegas con el
     * mismo nombre. El alcance es por landlord ---dos gestores distintos sí
     * pueden repetir título--- y se ignoran las filas con soft-delete para
     * que un nombre liberado por HUG-07 pueda reutilizarse.
     *
     * El landlord se resuelve aquí desde el usuario autenticado (nunca desde
     * el payload); si la cuenta no tiene perfil de landlord, la regla se
     * omite y StoreRoomsController::store responde 403 más adelante.
     */
    private function uniqueTitlePerLandlord(): Unique|string
    {
        $landlordId = Landlords::where('user_id', $this->user()?->id)->value('id');

        if ($landlordId === null) {
            return 'string';
        }

        return Rule::unique('storeRooms', 'title')
            ->where('landlord_id', $landlordId)
            ->whereNull('deleted_at');
    }

    /**
     * Preserva el envelope legacy {message, errors, status} en lugar del
     * 422 por defecto de FormRequest (fuente: ApiController::storeModel,
     * líneas 43-47).
     */
    protected function failedValidation(Validator $validator): void
    {
        throw new HttpResponseException(response()->json([
            'message' => 'Validation Error',
            'errors' => $validator->errors(),
            'status' => 400,
        ], 400));
    }
}
