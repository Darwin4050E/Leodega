<?php

namespace App\Services;

use App\Exceptions\DuplicateRatingException;
use App\Models\Ratings;
use App\Models\User;

class RatingsService
{
    /**
     * Extraído de RatingsController::store: la regla de negocio real es
     * "un usuario no puede calificar la misma bodega dos veces". Antes vivía
     * inline en el controlador; ahora es testeable de forma aislada.
     *
     * @throws DuplicateRatingException si el usuario ya calificó esta bodega.
     */
    public function create(User $user, array $data): Ratings
    {
        $alreadyRated = Ratings::where('store_id', $data['store_id'])
            ->where('user_id', $user->id)
            ->exists();

        if ($alreadyRated) {
            throw new DuplicateRatingException;
        }

        return Ratings::create([
            'store_id' => $data['store_id'],
            'user_id' => $user->id,
            'stars' => $data['stars'],
            'comment' => $data['comment'],
        ]);
    }

    /**
     * Shared rating summary used by both StoreRoomsController::index() and
     * ::detail(), so the two endpoints never diverge on how `rating_avg`
     * and `rating_count` are computed (see Engram obs #220, decision #3).
     *
     * The `?? 0` guard exists because Eloquent's avg() returns NULL when a
     * storeroom has zero ratings, and round(null, ...) is deprecated as of
     * PHP 8.1 even though it still returns a correct float(0) (obs #221).
     *
     * @return array{avg: float, count: int}
     */
    public function summaryFor(int $storeId): array
    {
        $ratings = Ratings::where('store_id', $storeId);

        return [
            'avg' => round($ratings->avg('stars') ?? 0, 1),
            'count' => $ratings->count(),
        ];
    }
}
