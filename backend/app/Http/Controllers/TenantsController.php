<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreTenantRequest;
use App\Http\Requests\UpdateTenantRequest;
use App\Models\Tenants;
use Illuminate\Http\Request;

class TenantsController extends ApiController
{
    //
    public function index()
    {
        return $this->indexModel(Tenants::class);
    }

    public function show($id)
    {
        return $this->showModel(Tenants::class, $id);
    }

    public function store(Request $request)
    {
        return $this->storeModel($request, Tenants::class, (new StoreTenantRequest)->rules());
    }

    public function update(Request $request, $id)
    {
        return $this->updateModel($request, Tenants::class, $id, (new UpdateTenantRequest)->rules());
    }

    public function destroy($id)
    {
        return $this->destroyModel(Tenants::class, $id);
    }
}
