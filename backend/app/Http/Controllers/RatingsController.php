<?php

namespace App\Http\Controllers;

use App\Exceptions\DuplicateRatingException;
use App\Http\Requests\StoreRatingRequest;
use App\Http\Requests\UpdateRatingRequest;
use App\Models\Ratings;
use App\Services\RatingsService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class RatingsController extends ApiController
{
    public function index(Request $request)
    {
        $storeId = $request->query('store_id');

        if (! $storeId) {
            return response()->json(['message' => 'store_id requerido'], 400);
        }

        $ratings = Ratings::where('store_id', $storeId)->get();

        return response()->json([
            'average' => round($ratings->avg('stars'), 1),
            'total' => $ratings->count(),
            'ratings' => $ratings,
        ]);
    }

    public function show($id)
    {
        return $this->showModel(Ratings::class, $id);
    }

    public function store(StoreRatingRequest $request, RatingsService $ratingsService)
    {
        $user = Auth::user();

        if (! $user) {
            return response()->json(['message' => 'No autenticado'], 401);
        }

        try {
            $rating = $ratingsService->create($user, $request->validated());
        } catch (DuplicateRatingException) {
            return response()->json([
                'message' => 'Ya calificaste esta bodega',
            ], 409);
        }

        return response()->json([
            'message' => 'Rating creado correctamente',
            'rating' => $rating,
        ], 201);
    }

    public function update(Request $request, $id)
    {
        return $this->updateModel($request, Ratings::class, $id, (new UpdateRatingRequest)->rules());
    }

    public function destroy($id)
    {
        return $this->destroyModel(Ratings::class, $id);
    }
}
