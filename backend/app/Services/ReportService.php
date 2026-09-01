<?php

namespace App\Services;

use App\Enums\NotificationType;
use App\Models\Reports;
use App\Models\StoreRooms;
use App\Models\User;
use Illuminate\Support\Facades\Log;

class ReportService
{
    /**
     * Extraído de ReportsController::store: crea el reporte, adjunta la
     * evidencia subida (si hay) y notifica a todos los admins más al
     * landlord dueño de la bodega (evitando duplicar si el landlord también
     * es admin). Antes toda esta orquestación vivía en el controlador.
     */
    public function create(?int $reportingUserId, array $data, iterable $files = []): Reports
    {
        $report = Reports::create([
            'user_id' => $reportingUserId,
            'store_id' => $data['store_id'],
            'title' => $data['title'],
            'priority' => $data['priority'],
            'report_type' => $data['report_type'],
            'description' => $data['description'],
            'status' => 'pending',
            'cancelation_reason' => null,
        ]);

        foreach ($files as $file) {
            $path = $file->store('reports', 'public');

            $report->evidences()->create([
                'file_path' => $path,
                'file_type' => $file->getClientMimeType(),
            ]);
        }

        $this->notifyAdminsAndLandlord($reportingUserId, $report);

        return $report;
    }

    private function notifyAdminsAndLandlord(?int $reportingUserId, Reports $report): void
    {
        $admins = User::where('role', 'admin')->get();

        foreach ($admins as $admin) {
            NotificationService::send(
                $reportingUserId,
                $admin->id,
                NotificationType::STORE_REPORTED,
                'Nuevo Reporte Creado',
                $report->title,
                [
                    'report_id' => $report->id,
                    'store_id' => $report->store_id,
                    'priority' => $report->priority,
                ]
            );
        }

        $store = StoreRooms::with('landlord.user')->find($report->store_id);

        if ($store && $store->landlord && $store->landlord->user) {
            $landlordUserId = $store->landlord->user->id;

            // Evitar duplicar si también es admin
            if (! $admins->contains('id', $landlordUserId)) {
                Log::info('Notificación a landlord', [
                    'to' => $landlordUserId,
                    'report_id' => $report->id,
                ]);

                NotificationService::send(
                    $reportingUserId,
                    $landlordUserId,
                    NotificationType::STORE_REPORTED,
                    'Reporte en tu bodega',
                    $report->title,
                    [
                        'report_id' => $report->id,
                        'store_id' => $report->store_id,
                        'priority' => $report->priority,
                    ]
                );
            }
        }
    }
}
