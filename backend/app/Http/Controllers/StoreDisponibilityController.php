<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreStoreDisponibilityRequest;
use App\Http\Requests\UpdateStoreDisponibilityRequest;
use App\Models\StoreDisponibility;
use Illuminate\Http\Request;

class StoreDisponibilityController extends ApiController
{
    public function index()
    {
        return $this->indexModel(StoreDisponibility::class);
    }

    public function show($id)
    {
        return $this->showModel(StoreDisponibility::class, $id);
    }

    public function store(Request $request)
    {
        return $this->storeModel($request, StoreDisponibility::class, (new StoreStoreDisponibilityRequest)->rules());
    }

    public function update(Request $request, $id)
    {
        return $this->updateModel($request, StoreDisponibility::class, $id, (new UpdateStoreDisponibilityRequest)->rules());
    }

    public function destroy($id)
    {
        return $this->destroyModel(StoreDisponibility::class, $id);
    }
}
