<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreOrganizationRequest;
use App\Http\Resources\OrganizationResource;
use App\Services\OrganizationService;
use Illuminate\Support\Arr;

class OrganizationController extends Controller
{
    public function store(StoreOrganizationRequest $request, OrganizationService $service)
    {
        $organization = $service->create(
            $request->user(),
            Arr::except($request->validated(), ['logo']),
            $request->file('logo')
        );

        return response()->json([
            'message' => 'Organización creada correctamente',
            'organization' => (new OrganizationResource($organization))->resolve(),
        ], 201);
    }
}
