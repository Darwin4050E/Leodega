<?php

namespace App\Http\Requests;

use App\Enums\OrganizationRole;
use App\Http\Middleware\ResolveActiveOrganization;
use App\Models\Organization;
use App\Support\Money;
use Closure;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Http\Exceptions\HttpResponseException;

/**
 * Simulated wallet top-up (org-wallet OW-4). Authorization runs before
 * validation so a non-admin never learns which amounts would be accepted:
 * the organization comes from the URL path (the X-Organization-Id header is
 * ignored) and the caller must be one of its admins. Every invalid amount
 * (missing, non-numeric, more than 2 decimals, out of range) carries the
 * same message; `amount` is accepted as a string or a JSON number.
 */
class TopUpWalletRequest extends FormRequest
{
    public const AMOUNT_MESSAGE = 'El monto de la recarga debe estar entre $50 y $50.000';

    private const MIN_CENTS = 5_000;

    private const MAX_CENTS = 5_000_000;

    private ?Organization $organization = null;

    private string $denial = ResolveActiveOrganization::FORBIDDEN_MESSAGE;

    public function authorize(): bool
    {
        $this->organization = $this->user()->organizations()
            ->whereKey((int) $this->route('organization'))
            ->first();

        if (! $this->organization) {
            return false;
        }

        if ($this->organization->pivot->role !== OrganizationRole::ADMIN->value) {
            $this->denial = 'No autorizado';

            return false;
        }

        return true;
    }

    /**
     * The organization resolved by authorize(), carrying the caller's pivot.
     */
    public function organization(): Organization
    {
        return $this->organization;
    }

    public function rules(): array
    {
        return [
            'amount' => [
                'bail',
                'required',
                'regex:/^\d+(\.\d{1,2})?$/',
                function (string $attribute, mixed $value, Closure $fail) {
                    $cents = Money::parse((string) $value);

                    if ($cents < self::MIN_CENTS || $cents > self::MAX_CENTS) {
                        $fail(self::AMOUNT_MESSAGE);
                    }
                },
            ],
        ];
    }

    public function messages(): array
    {
        return [
            'amount.required' => self::AMOUNT_MESSAGE,
            'amount.regex' => self::AMOUNT_MESSAGE,
        ];
    }

    protected function failedAuthorization(): never
    {
        throw new HttpResponseException(response()->json(['message' => $this->denial], 403));
    }
}
