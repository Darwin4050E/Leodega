<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreAdminRequest;
use App\Http\Requests\UpdateAdminRequest;
use App\Models\Admin;
use Illuminate\Http\Request;

class AdminController extends ApiController
{
    //
    public function index()
    {
        return $this->indexModel(Admin::class);
    }

    public function show($id)
    {
        return $this->showModel(Admin::class, $id);
    }

    public function store(Request $request)
    {
        return $this->storeModel($request, Admin::class, (new StoreAdminRequest)->rules());
    }

    public function update(Request $request, $id)
    {
        return $this->updateModel($request, Admin::class, $id, (new UpdateAdminRequest)->rules());
    }

    public function destroy($id)
    {
        return $this->destroyModel(Admin::class, $id);
    }
}
