<?php

namespace App\Support;

use App\Enums\OrganizationRole;
use App\Models\Organization;
use Illuminate\Http\Request;
use LogicException;

/**
 * Typed read access to the context resolved by the `org.context` middleware
 * (ResolveActiveOrganization). The middleware owns the two request attributes;
 * this class only wraps them so consumers never read untyped attributes.
 */
readonly class ActiveContext
{
    public const ORGANIZATION_ATTRIBUTE = 'active_organization';

    public const ROLE_ATTRIBUTE = 'active_organization_role';

    public function __construct(
        public ?Organization $organization,
        public ?OrganizationRole $role,
    ) {}

    public static function personal(): self
    {
        return new self(null, null);
    }

    public static function organization(Organization $organization, OrganizationRole $role): self
    {
        return new self($organization, $role);
    }

    /**
     * Fails loudly when the middleware did not run: a missing attribute must
     * never be mistaken for the personal context.
     */
    public static function fromRequest(Request $request): self
    {
        if (! $request->attributes->has(self::ORGANIZATION_ATTRIBUTE)) {
            throw new LogicException('The org.context middleware did not run for this request.');
        }

        $organization = $request->attributes->get(self::ORGANIZATION_ATTRIBUTE);
        $role = $request->attributes->get(self::ROLE_ATTRIBUTE);

        return $organization === null || $role === null
            ? self::personal()
            : self::organization($organization, $role);
    }

    public function isPersonal(): bool
    {
        return $this->organization === null;
    }

    public function isOrganization(): bool
    {
        return $this->organization !== null;
    }
}
