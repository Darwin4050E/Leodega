<?php

namespace App\Services;

use App\Enums\InvitationStatus;
use App\Models\Organization;
use App\Models\OrganizationInvitation;
use App\Models\User;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Invitations of registered clients to an organization (hue-01 INV-4..INV-7).
 *
 * Every refusal is a static message: nothing about the invitee (name, id,
 * state) may leak to the admin beyond what the ERS mandates.
 */
class OrganizationInvitationService
{
    public const GESTOR_MESSAGE = 'Solo puedes invitar a clientes; los gestores de bodega no pueden unirse a organizaciones.';

    public const ALREADY_MEMBER_MESSAGE = 'Este usuario ya es miembro de tu organización';

    // Shared by an unknown email and by accounts that must not be revealed
    // (platform admin, blocked, pending state): the responses stay identical.
    public const UNKNOWN_CLIENT_MESSAGE = 'No encontramos un cliente con ese correo electrónico.';

    public const PENDING_EXISTS_MESSAGE = 'Ya hay una invitación pendiente para este usuario en tu organización.';

    public const INACTIVE_ORGANIZATION_MESSAGE = 'La organización seleccionada no está activa.';

    /**
     * Rules run in order, first failure wins: organization active, invitee
     * lookup, account state before role, tenant only, already a member,
     * non-lapsed pending invitation.
     *
     * @throws ValidationException
     */
    public function invite(Organization $organization, User $inviter, string $email): OrganizationInvitation
    {
        if ($organization->status !== 'active') {
            throw ValidationException::withMessages(['organization' => self::INACTIVE_ORGANIZATION_MESSAGE]);
        }

        $invitee = $this->resolveInvitee($email);

        if ($organization->users()->whereKey($invitee->id)->exists()) {
            throw ValidationException::withMessages(['email' => self::ALREADY_MEMBER_MESSAGE]);
        }

        try {
            return DB::transaction(function () use ($organization, $inviter, $invitee) {
                $existing = $organization->invitations()
                    ->where('invited_user_id', $invitee->id)
                    ->where('status', InvitationStatus::Pending->value)
                    ->lockForUpdate()
                    ->first();

                if ($existing) {
                    if ($existing->expires_at->gt(now())) {
                        throw $this->pendingExists();
                    }

                    // A lapsed row still holds the partial unique slot. Close it
                    // in the same transaction, before the insert.
                    $existing->update(['status' => InvitationStatus::Expired]);
                }

                $invitation = $organization->invitations()->create([
                    'invited_user_id' => $invitee->id,
                    'invited_by_user_id' => $inviter->id,
                    'email' => mb_strtolower($invitee->email),
                    'status' => InvitationStatus::Pending,
                    'expires_at' => now()->addDays(OrganizationInvitation::EXPIRY_DAYS),
                ]);

                return $invitation->setRelation('inviter', $inviter);
            });
        } catch (UniqueConstraintViolationException) {
            // A concurrent invite committed first. Caught outside the
            // transaction because PostgreSQL aborts it on a unique violation.
            throw $this->pendingExists();
        }
    }

    private function pendingExists(): ValidationException
    {
        return ValidationException::withMessages(['email' => self::PENDING_EXISTS_MESSAGE]);
    }

    /**
     * The eligible invitee for an email, matched trimmed and case-insensitively
     * (pgsql string comparison is case-sensitive and registration does not
     * normalize the address).
     *
     * @throws ValidationException
     */
    private function resolveInvitee(string $email): User
    {
        $invitee = User::query()
            ->whereRaw('LOWER(email) = ?', [mb_strtolower(trim($email))])
            ->orderBy('id')
            ->first();

        // State is checked before role so a blocked gestor reads as unknown.
        if (! $invitee || $invitee->state !== 'active' || $invitee->role === 'admin') {
            throw ValidationException::withMessages(['email' => self::UNKNOWN_CLIENT_MESSAGE]);
        }

        if ($invitee->role !== 'tenant') {
            throw ValidationException::withMessages(['email' => self::GESTOR_MESSAGE]);
        }

        return $invitee;
    }
}
