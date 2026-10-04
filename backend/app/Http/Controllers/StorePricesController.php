<?php

namespace App\Http\Controllers;

use App\Models\StorePrices;

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
}
