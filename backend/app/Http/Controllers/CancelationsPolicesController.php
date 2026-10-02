<?php

namespace App\Http\Controllers;

use App\Models\CancelationsPolices;

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
}
