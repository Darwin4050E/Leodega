<?php

namespace App\Http\Controllers;

use App\Services\DashboardService;
use Illuminate\Http\Request;

/**
 * Two admin-only GET endpoints backing the dashboard screen at
 * `/admin/resumen`. Method-level DI, matching
 * `StoreRoomsController::update`/`::destroy`'s existing convention.
 */
class DashboardController extends Controller
{
    public function summary(DashboardService $service)
    {
        return response()->json($service->summary());
    }

    public function activity(Request $request, DashboardService $service)
    {
        $limit = (int) $request->query('limit', 10);

        return response()->json($service->activity($limit));
    }
}
