<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class StoreReservationRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'store_room_id' => ['required', 'exists:storeRooms,id'],
            'start_date' => ['required', 'date', 'after_or_equal:today'],
            'end_date' => ['required', 'date', 'after_or_equal:start_date'],
        ];
    }

    /**
     * "today" is the server's date (UTC). A client behind UTC can pick its
     * own local today after the server already rolled over, so the message
     * names the server date instead of blaming the user.
     */
    public function messages(): array
    {
        return [
            'start_date.after_or_equal' => 'La fecha de inicio no puede ser anterior a hoy (fecha del servidor, UTC).',
        ];
    }
}
