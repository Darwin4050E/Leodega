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
}
