<?php

namespace App\Http\Requests;

use App\Models\Landlords;
use Illuminate\Contracts\Validation\Validator;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Http\Exceptions\HttpResponseException;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\Unique;

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
            'title' => ['sometimes', 'string', 'max:255', $this->uniqueTitlePerLandlord()],
            'description' => 'sometimes|string',
            'size' => 'sometimes|numeric|gt:0|max:99999999.99',
            'price' => 'sometimes|numeric|gt:0',
            'disponibility' => 'sometimes|boolean',
        ];
    }

    public function messages(): array
    {
        return [
            'title.unique' => 'Ya tienes una bodega publicada con ese nombre. Elige otro nombre para continuar.',
        ];
    }

    /**
     * Same scope as StoreStoreRoomRequest: per landlord, soft-deleted rooms
     * ignored. The room being edited is ignored too, so resending its own
     * title is not a duplicate.
     */
    private function uniqueTitlePerLandlord(): Unique|string
    {
        $landlordId = Landlords::where('user_id', $this->user()?->id)->value('id');

        if ($landlordId === null) {
            return 'string';
        }

        return Rule::unique('storeRooms', 'title')
            ->where('landlord_id', $landlordId)
            ->whereNull('deleted_at')
            ->ignore((int) $this->route('id'));
    }

    /**
     * Preserve the legacy "Validation Error" message ({message, errors})
     * instead of FormRequest's default message (source:
     * StoreStoreRoomRequest::failedValidation()).
     */
    protected function failedValidation(Validator $validator): void
    {
        throw new HttpResponseException(response()->json([
            'message' => 'Validation Error',
            'errors' => $validator->errors(),
        ], 422));
    }
}
