<?php

namespace App\Http\Requests;

use App\Enums\OrganizationRole;
use App\Http\Middleware\ResolveActiveOrganization;
use App\Models\Organization;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Http\Exceptions\HttpResponseException;

/**
 * Invite a registered client to an organization (hue-01 INV-2, INV-3).
 * Authorization runs before validation so a non-admin never learns what a
 * valid body looks like: the organization comes from the URL path (the
 * X-Organization-Id header is ignored) and the caller must be one of its
 * admins, read live from the organization_user pivot.
 */
class InviteMemberRequest extends FormRequest
{
    public const NOT_ADMIN_MESSAGE = 'No autorizado';

    public const EMAIL_MISSING_MESSAGE = 'Escribe el correo del cliente que quieres invitar.';

    public const EMAIL_INVALID_MESSAGE = 'Ingresa un correo válido.';

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
            $this->denial = self::NOT_ADMIN_MESSAGE;

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

    protected function prepareForValidation(): void
    {
        $email = $this->input('email');

        if (is_string($email)) {
            $this->merge(['email' => trim($email)]);
        }
    }

    public function rules(): array
    {
        return [
            'email' => ['bail', 'required', 'string', 'email', 'max:255'],
        ];
    }

    public function messages(): array
    {
        return [
            'email.required' => self::EMAIL_MISSING_MESSAGE,
            'email.string' => self::EMAIL_INVALID_MESSAGE,
            'email.email' => self::EMAIL_INVALID_MESSAGE,
            'email.max' => self::EMAIL_INVALID_MESSAGE,
        ];
    }

    protected function failedAuthorization(): never
    {
        throw new HttpResponseException(response()->json(['message' => $this->denial], 403));
    }
}
