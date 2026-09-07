<?php

namespace App\Casts;

use Illuminate\Contracts\Database\Eloquent\CastsAttributes;
use Illuminate\Database\Eloquent\Model;

/**
 * Read-normalising, write-tolerant cast for StoreRooms::$security.
 *
 * The column stores whatever JSON string the registration wizard sends
 * (StoreStoreRoomRequest::rules() still validates it as `required|string`),
 * so the write side is intentionally left untouched here — see design
 * #163 section 4. This cast only normalises what get() returns: it always
 * yields exactly four booleans (`camara`, `ruido`, `control`, `acceso`),
 * even for malformed, legacy, or empty values.
 *
 * The legacy `objetos` key is never read here, so it is discarded rather
 * than mapped onto `acceso` (decision #161.1) — mapping it would assert a
 * safety feature the landlord never declared.
 */
class SecurityFeatures implements CastsAttributes
{
    private const KEYS = ['camara', 'ruido', 'control', 'acceso'];

    /**
     * @param  array<string, mixed>  $attributes
     * @return array<string, bool>
     */
    public function get(Model $model, string $key, mixed $value, array $attributes): array
    {
        $decoded = is_string($value) ? json_decode($value, true) : null;

        if (! is_array($decoded)) {
            $decoded = [];
        }

        $features = [];
        foreach (self::KEYS as $featureKey) {
            $features[$featureKey] = (bool) ($decoded[$featureKey] ?? false);
        }

        return $features;
    }

    public function set(Model $model, string $key, mixed $value, array $attributes): string
    {
        return is_array($value) ? json_encode($value) : (string) $value;
    }
}
