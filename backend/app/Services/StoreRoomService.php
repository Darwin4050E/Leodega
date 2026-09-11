<?php

namespace App\Services;

use App\Enums\NotificationType;
use App\Exceptions\StoreRoomResubmissionException;
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
use Illuminate\Validation\ValidationException;

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

        $this->notifyAdmins($actingUserId, $room, NotificationType::STORE_CREATED, 'Nueva bodega pendiente de verificación');

        return $room;
    }

    /**
     * SDD 2, decision #5: pure state transition, `rejected` -> `pending`.
     * No listing field is touched here — the gestor edits through
     * updateListing()/editListing() first, then calls this as a separate
     * explicit action (addendum #174.3). No new `store_moderation` row is
     * written: this table records admin decisions, and a resubmission is a
     * gestor self-service action with no decision attached; prior rows
     * survive untouched.
     *
     * @throws StoreRoomResubmissionException 409 when the room is not
     *                                         currently `rejected`
     */
    public function resubmit(StoreRooms $room, int $actingUserId): StoreRooms
    {
        if ($room->publication_status !== 'rejected') {
            throw StoreRoomResubmissionException::conflict('La bodega no está rechazada; no hay nada que reenviar.');
        }

        $room = DB::transaction(function () use ($room) {
            $room->update(['publication_status' => 'pending']);

            return $room->fresh();
        });

        // Post-commit, best-effort fan-out — mirrors register()'s own
        // notifyAdmins() call: a transient notification failure must never
        // roll back a resubmission the gestor is otherwise entitled to make.
        $this->notifyAdmins($actingUserId, $room, NotificationType::STORE_RESUBMITTED, 'Bodega reenviada a revisión');

        return $room;
    }

    /**
     * HUG-08: partial edit of an already published listing by its owner.
     *
     * Only the fields the caller actually sent (already validated and
     * whitelisted by EditStoreRoomListingRequest) are touched. The monthly
     * price lives in a separate store_prices row: it is updated in place
     * with a targeted ->update() — never delete + recreate — so nothing
     * that references it (reservations read a price snapshot, but be
     * conservative anyway) is disturbed.
     *
     * Everything runs inside one transaction: an invalid state (e.g. a
     * price change requested on a room with no monthly tariff row) rolls
     * back the scalar changes too (atomicity, acceptance criterion 2).
     *
     * @throws ValidationException when `price`/`disponibility` is sent but
     *                             the room has no mode='month' price row
     */
    public function updateListing(StoreRooms $room, array $data): StoreRooms
    {
        return DB::transaction(function () use ($room, $data) {
            $scalars = Arr::only($data, ['title', 'description', 'size']);
            if (! empty($scalars)) {
                $room->update($scalars);
            }

            $priceChanges = Arr::only($data, ['price', 'disponibility']);
            if (! empty($priceChanges)) {
                $monthlyPrice = $room->storePrices()->where('mode', 'month')->first();

                if (! $monthlyPrice) {
                    throw ValidationException::withMessages([
                        'price' => 'La bodega no tiene una tarifa mensual configurada que se pueda actualizar.',
                    ]);
                }

                $monthlyPrice->update($priceChanges);
            }

            return $room->fresh(['storePrices']);
        });
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

    /**
     * Generalized in SDD 2 (task B4) to accept the notification type/title,
     * so both register() (STORE_CREATED) and resubmit() (STORE_RESUBMITTED)
     * share this one admin fan-out instead of duplicating it.
     */
    private function notifyAdmins(int $actingUserId, StoreRooms $room, NotificationType $type, string $title): void
    {
        try {
            $admins = User::where('role', 'admin')->get();

            foreach ($admins as $admin) {
                NotificationService::send(
                    $actingUserId,
                    $admin->id,
                    $type,
                    $title,
                    $room->title,
                    ['store_room_id' => $room->id]
                );
            }
        } catch (\Throwable $e) {
            // Post-commit: un fallo de notificación nunca revierte ni borra
            // la bodega/permiso ya persistidos (D5).
            Log::warning('Fallo al notificar evento de bodega', [
                'store_room_id' => $room->id,
                'notification_type' => $type->value,
                'error' => $e->getMessage(),
            ]);
        }
    }
}
