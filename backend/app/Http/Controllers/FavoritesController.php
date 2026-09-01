<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreFavoriteRequest;
use App\Http\Requests\UpdateFavoriteRequest;
use App\Models\Favorites;
use Illuminate\Http\Request;

class FavoritesController extends ApiController
{
    //
    public function index()
    {
        return $this->indexModel(Favorites::class);
    }

    public function show($id)
    {
        return $this->showModel(Favorites::class, $id);
    }

    public function store(Request $request)
    {
        return $this->storeModel($request, Favorites::class, (new StoreFavoriteRequest)->rules());
    }

    public function update(Request $request, $id)
    {
        return $this->updateModel($request, Favorites::class, $id, (new UpdateFavoriteRequest)->rules());
    }

    public function destroy($id)
    {
        return $this->destroyModel(Favorites::class, $id);
    }
}
