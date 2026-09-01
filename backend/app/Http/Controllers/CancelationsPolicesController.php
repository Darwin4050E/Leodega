<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreCancelationsPolicesRequest;
use App\Http\Requests\UpdateCancelationsPolicesRequest;
use App\Models\cancelations_polices;
use Illuminate\Http\Request;

class CancelationsPolicesController extends ApiController
{
    //
    public function index()
    {
        return $this->indexModel(cancelations_polices::class);
    }

    public function show($id)
    {
        return $this->showModel(cancelations_polices::class, $id);
    }

    public function store(Request $request)
    {
        return $this->storeModel($request, cancelations_polices::class, (new StoreCancelationsPolicesRequest)->rules());
    }

    public function update(Request $request, $id)
    {
        return $this->updateModel($request, cancelations_polices::class, $id, (new UpdateCancelationsPolicesRequest)->rules());
    }

    public function destroy($id)
    {
        return $this->destroyModel(cancelations_polices::class, $id);
    }
}
