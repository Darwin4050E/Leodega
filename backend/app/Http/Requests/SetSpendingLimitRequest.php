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
 * Sets or clears a member's monthly limit (member-spending-limit ML-2, ML-14).
 * Same authorization shape as TopUpWalletRequest: it runs before validation so
 * a non-admin never learns which values would be accepted, the organization
 * comes from the URL path and the caller must be one of its admins. The key
 * must be present; null clears the limit. Every invalid value carries the same
 * message, and a value with more than 2 decimals is rejected, never rounded.
 */
class SetSpendingLimitRequest extends FormRequest
{
    public const LIMIT_MESSAGE = 'El límite mensual debe ser un monto mayor que 0, con hasta 6 dígitos enteros y 2 decimales';

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
            'monthly_limit' => [
                'bail',
                'present',
                'nullable',
                'regex:/^\d{1,6}(\.\d{1,2})?$/',
                function (string $attribute, mixed $value, Closure $fail) {
                    if (Money::parse((string) $value) < 1) {
                        $fail(self::LIMIT_MESSAGE);
                    }
                },
            ],
        ];
    }

    public function messages(): array
    {
        return [
            'monthly_limit.present' => self::LIMIT_MESSAGE,
            'monthly_limit.regex' => self::LIMIT_MESSAGE,
        ];
    }

    protected function failedAuthorization(): never
    {
        throw new HttpResponseException(response()->json(['message' => $this->denial], 403));
    }
}
