<?php

namespace App\Http\Requests;

use Illuminate\Contracts\Validation\Validator;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Http\Exceptions\HttpResponseException;

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
            'title' => 'required|string',
            'description' => 'required|string',
            'security' => 'required|string',
            'firefighter_permit' => 'required|file|mimes:pdf,jpg,jpeg,png|max:5120',
        ];
    }

    public function messages(): array
    {
        return [
            'firefighter_permit.required' => 'Debe adjuntar el permiso de bomberos vigente para continuar.',
            'firefighter_permit.mimes' => 'El permiso debe ser un archivo PDF, JPG, JPEG o PNG.',
            'firefighter_permit.max' => 'El permiso no debe superar los 5 MB.',
        ];
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
