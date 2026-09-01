<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreStorePricesRequest;
use App\Http\Requests\UpdateStorePricesRequest;
use App\Models\StorePrices;
use Illuminate\Http\Request;

class StorePricesController extends ApiController
{
    public function index()
    {
        return $this->indexModel(StorePrices::class);
    }

    public function show($id)
    {
        return $this->showModel(StorePrices::class, $id);
    }

    public function store(Request $request)
    {
        return $this->storeModel($request, StorePrices::class, (new StoreStorePricesRequest)->rules());
    }

    public function update(Request $request, $id)
    {
        return $this->updateModel($request, StorePrices::class, $id, (new UpdateStorePricesRequest)->rules());
    }

    public function destroy($id)
    {
        return $this->destroyModel(StorePrices::class, $id);
    }
}
