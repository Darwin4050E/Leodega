<?php

namespace App\Http\Requests;

/**
 * Bolsa de reglas, no FormRequest — ver StoreAdminRequest para la explicación
 * completa de por qué no se inyecta como type-hint.
 */
class UpdateReportRequest
{
    public function rules(): array
    {
        return [
            'store_id' => 'sometimes|exists:storeRooms,id',
            'reported_user_id' => 'nullable|exists:user,id',
            'title' => 'sometimes|string|max:255',
            'report_type' => 'sometimes|string|max:255',
            'priority' => 'sometimes|in:low,medium,high',
            'description' => 'sometimes|string|min:20',
            'status' => 'sometimes|in:pending,confirmed,canceled, in_review',
            'cancelation_reason' => 'nullable|string|max:1000',
        ];
    }
}
