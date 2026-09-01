<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreReportRequest;
use App\Http\Requests\UpdateReportRequest;
use App\Http\Requests\UpdateReportStatusRequest;
use App\Models\Reports;
use App\Services\ReportService;
use Illuminate\Http\Request;

class ReportsController extends ApiController
{
    //
    public function index()
    {
        return Reports::with(['user', 'store', 'evidences'])->get();
    }

    public function show($id)
    {
        $report = Reports::with(['user', 'store', 'evidences'])->findOrFail($id);

        return response()->json(['report' => $report]);
    }

    public function store(StoreReportRequest $request, ReportService $reportService)
    {
        $report = $reportService->create(
            auth()->id(),
            $request->only(['store_id', 'title', 'priority', 'report_type', 'description']),
            $request->hasFile('files') ? $request->file('files') : []
        );

        return response()->json([
            'message' => 'Reporte creado correctamente',
            'report' => $report,
        ], 201);
    }

    public function update(Request $request, $id)
    {
        return $this->updateModel($request, Reports::class, $id, (new UpdateReportRequest)->rules());
    }

    public function updateStatus(UpdateReportStatusRequest $request, Reports $report)
    {
        $data = $request->validated();

        if ($data['status'] === 'resolved') {
            $report->update([
                'status' => 'resolved',
                'cancelation_reason' => null,
            ]);

            return response()->json([
                'message' => 'Reporte resuelto',
                'report' => $report->load(['user', 'store', 'evidences']),
            ]);
        }

        $report->update([
            'status' => 'canceled',
            'cancelation_reason' => $data['cancelation_reason'] ?? 'Canceled by admin',
        ]);

        return response()->json([
            'message' => 'Reporte cancelado',
            'report' => $report->load(['user', 'store', 'evidences']),
        ]);
    }

    public function destroy($id)
    {
        return $this->destroyModel(Reports::class, $id);
    }
}
