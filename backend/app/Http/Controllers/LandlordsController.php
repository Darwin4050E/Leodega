<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreLandlordRequest;
use App\Http\Requests\UpdateLandlordRequest;
use App\Models\Landlords;
use Illuminate\Http\Request;

class LandlordsController extends ApiController
{
    //
    public function index()
    {
        return $this->indexModel(Landlords::class);
    }

    public function show($id)
    {
        return $this->showModel(Landlords::class, $id);
    }

    public function store(Request $request)
    {
        return $this->storeModel($request, Landlords::class, (new StoreLandlordRequest)->rules());
    }

    public function update(Request $request, $id)
    {
        return $this->updateModel($request, Landlords::class, $id, (new UpdateLandlordRequest)->rules());
    }

    public function destroy($id)
    {
        return $this->destroyModel(Landlords::class, $id);
    }
}
