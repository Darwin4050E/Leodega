<?php

namespace App\Http\Requests;

use Illuminate\Contracts\Validation\Validator;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Http\Exceptions\HttpResponseException;

/**
 * HUG-08: partial edit of an already published storeroom by its owning
 * gestor. Every rule is `sometimes` — the caller may send any subset of
 * the editable fields.
 *
 * Editable fields only: title, description, size and the monthly price
 * (price + disponibility of the mode='month' store_prices row). The
 * request deliberately does NOT list landlord_id, publication_status,
 * room_type, storage_type, direction, city or firefighter_permit: those
 * are out of scope and are ignored because validated() only returns keys
 * that appear in rules().
 *
 * authorize() returns true: ownership is enforced in the controller with
 * the resolved Landlords model (Gate::authorize('update', ...)), the same
 * way destroy() does it, so a missing landlord profile can still surface
 * as a 404 instead of a 403.
 */
class EditStoreRoomListingRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'title' => 'sometimes|string|max:255',
            'description' => 'sometimes|string',
            'size' => 'sometimes|numeric|gt:0',
            'price' => 'sometimes|numeric|gt:0',
            'disponibility' => 'sometimes|boolean',
        ];
    }

    /**
     * Preserve the legacy {message, errors, status} envelope with a 400
     * instead of FormRequest's default 422 (source:
     * StoreStoreRoomRequest::failedValidation()).
     */
    protected function failedValidation(Validator $validator): void
    {
        throw new HttpResponseException(response()->json([
            'message' => 'Validation Error',
            'errors' => $validator->errors(),
            'status' => 400,
        ], 400));
    }
}
