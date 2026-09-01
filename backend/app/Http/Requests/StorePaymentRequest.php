<?php

namespace App\Http\Requests;

/**
 * Bolsa de reglas, no FormRequest — ver StoreAdminRequest para la explicación
 * completa de por qué no se inyecta como type-hint.
 */
class StorePaymentRequest
{
    public function rules(): array
    {
        return [
            'reservation_id' => 'required|exists:reservations,id',
            'payment_method' => 'required|in:credit card,debit card',
            'payment_state' => 'required|in:paid,pending,failed',
            'payment_date' => 'date',
        ];
    }
}
