<?php

namespace App\Http\Controllers;

use App\Models\Landlords;

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
}
