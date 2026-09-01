<?php

namespace App\Http\Requests;

/**
 * Bolsa de reglas, no FormRequest — ver StoreAdminRequest para la explicación
 * completa de por qué no se inyecta como type-hint.
 */
class UpdatePaymentRequest
{
    public function rules(): array
    {
        return [
            'reservation_id' => 'sometimes|exists:reservations,id',
            'payment_method' => 'sometimes|in:credit card,debit card',
            'payment_state' => 'sometimes|in:paid,pending,failed',
            'payment_date' => 'sometimes|date',
        ];
    }
}
