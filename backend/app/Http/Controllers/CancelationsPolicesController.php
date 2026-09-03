<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreCancelationsPolicesRequest;
use App\Http\Requests\UpdateCancelationsPolicesRequest;
use App\Models\CancelationsPolices;
use Illuminate\Http\Request;

class CancelationsPolicesController extends ApiController
{
    //
    public function index()
    {
        return $this->indexModel(CancelationsPolices::class);
    }

    public function show($id)
    {
        return $this->showModel(CancelationsPolices::class, $id);
    }

    public function store(Request $request)
    {
        return $this->storeModel($request, CancelationsPolices::class, (new StoreCancelationsPolicesRequest)->rules());
    }

    public function update(Request $request, $id)
    {
        return $this->updateModel($request, CancelationsPolices::class, $id, (new UpdateCancelationsPolicesRequest)->rules());
    }

    public function destroy($id)
    {
        return $this->destroyModel(CancelationsPolices::class, $id);
    }
}
