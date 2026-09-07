<?php

namespace App\Services;

use App\Enums\NotificationType;
use App\Http\Requests\StoreStorePricesRequest;
use App\Models\Landlords;
use App\Models\StoreRooms;
use App\Models\User;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Validator;

/**
 * HUG-04: extraído de ApiController::storeModel (D1) porque el registro de
 * bodegas ahora necesita (a) forzar landlord_id/publication_status
 * server-side, (b) validar los precios anidados con sus propias reglas
 * (nunca vía el motor genérico de relaciones), y (c) manejar un archivo
 * subido (permiso de bomberos) cuya escritura a disco debe ocurrir solo
 * cuando el resto de la validación ya pasó.
 */
class StoreRoomService
{
    /**
     * @throws \Illuminate\Validation\ValidationException si storePrices es inválido
     */
    public function register(
        Landlords $landlord,
        array $data,
        ?array $prices,
        UploadedFile $permit,
        int $actingUserId
    ): StoreRooms {
        $prices = $this->coerceDisponibility($prices);
        $this->validatePrices($prices);

        // Solo se escribe a disco después de que TODA la validación pasó
        // (D11): así el permiso nunca queda huérfano por un error de
        // validación en storePrices, que es el fallo más probable.
        $path = $permit->store('firefighter_permits', 'private');

        try {
            $room = DB::transaction(function () use ($landlord, $data, $prices, $path) {
                // array_merge (not `+`) so the forced values always win over
                // anything the caller passed in $data — defense in depth for
                // D4/R4 even though the FormRequest already strips
                // landlord_id/publication_status from validated().
                $room = StoreRooms::create(array_merge($data, [
                    'landlord_id' => $landlord->id,
                    'publication_status' => 'pending',
                    'firefighter_permit_path' => $path,
                ]));

                if (! empty($prices)) {
                    $room->storePrices()->createMany($prices);
                }

                return $room->load('storePrices');
            });
        } catch (\Throwable $e) {
            // Compensating delete (D11): una transacción fallida no debe
            // dejar un archivo huérfano en el disco.
            Storage::disk('private')->delete($path);
            throw $e;
        }

        $this->notifyAdmins($actingUserId, $room);

        return $room;
    }

    /**
     * D13: bajo multipart, FormData serializa el booleano JS `true` como el
     * string "true", que la regla `boolean` de Laravel rechaza (solo acepta
     * true,false,1,0,"1","0"). Se coacciona antes de validar para no romper
     * el formulario existente.
     */
    private function coerceDisponibility(?array $prices): ?array
    {
        if (empty($prices)) {
            return $prices;
        }

        foreach ($prices as $i => $price) {
            if (array_key_exists('disponibility', $price)) {
                $prices[$i]['disponibility'] = filter_var(
                    $price['disponibility'],
                    FILTER_VALIDATE_BOOLEAN,
                    FILTER_NULL_ON_FAILURE
                ) ? 1 : 0;
            }
        }

        return $prices;
    }

    /**
     * storePrices is optional at registration (D7): when omitted, the room
     * is still created with zero prices — this early return is a deliberate
     * fix over the design's literal `sometimes|array|min:1` snippet, which
     * would always fail because the key is always present in the array
     * built below (Laravel's `sometimes` only skips a genuinely *missing*
     * key, not an empty one).
     *
     * @throws \Illuminate\Validation\ValidationException
     */
    private function validatePrices(?array $prices): void
    {
        if (empty($prices)) {
            return;
        }

        $childRules = Arr::except((new StoreStorePricesRequest)->rules(), ['store_room_id']);

        $rules = ['storePrices' => 'required|array|min:1'];
        foreach ($childRules as $field => $rule) {
            $rules["storePrices.*.{$field}"] = $rule;
        }

        Validator::make(['storePrices' => $prices], $rules)->validate();
    }

    private function notifyAdmins(int $actingUserId, StoreRooms $room): void
    {
        try {
            $admins = User::where('role', 'admin')->get();

            foreach ($admins as $admin) {
                NotificationService::send(
                    $actingUserId,
                    $admin->id,
                    NotificationType::STORE_CREATED,
                    'Nueva bodega pendiente de verificación',
                    $room->title,
                    ['store_room_id' => $room->id]
                );
            }
        } catch (\Throwable $e) {
            // Post-commit: un fallo de notificación nunca revierte ni borra
            // la bodega/permiso ya persistidos (D5).
            Log::warning('Fallo al notificar creación de bodega', [
                'store_room_id' => $room->id,
                'error' => $e->getMessage(),
            ]);
        }
    }
}
