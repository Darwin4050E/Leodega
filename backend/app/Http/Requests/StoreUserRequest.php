<?php

namespace App\Http\Requests;

/**
 * Rule bag, deliberately NOT a Laravel FormRequest: UserController passes these
 * rules to ApiController::storeModel(), which validates manually and answers
 * with its own validation error body. Injecting this class as a controller
 * type-hint would make Laravel resolve and validate it in the pipeline and
 * return its standard validation response instead, changing the API contract.
 * Use it only as a rule bag: (new StoreUserRequest)->rules(). The other
 * rule-bag classes in this namespace refer here for the full explanation.
 */
class StoreUserRequest
{
    public function rules(): array
    {
        return [
            'name' => 'required|string|max:255',
            'lastname' => 'required|string|max:255',
            'email' => 'required|string|email|max:255|unique:user',
            'phone' => 'required|string|unique:user|max:10',
            'password' => 'required|string|min:8',
            'role' => 'in:admin,landlord,tenant',
            'start_date' => 'date|default:now()',
            'state' => 'in:active,blocked,pending',
            'enable_messages' => 'required|boolean',
        ];
    }
}
