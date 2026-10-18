<?php

namespace App\Services;

use App\Enums\InvitationStatus;
use App\Exceptions\OrganizationInvitationException;
use App\Models\Organization;
use App\Models\OrganizationInvitation;
use App\Models\User;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\ValidationException;
use Throwable;

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

    // Expired rows stay in the inbox but only the most recent ones (huc-14 Q5).
    private const INBOX_EXPIRED_LIMIT = 20;

    private const INBOX_RELATIONS = ['organization:id,name', 'inviter:id,name'];

    public function __construct(private OrganizationInvitationNotifier $notifier) {}

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
            $invitation = DB::transaction(function () use ($organization, $inviter, $invitee) {
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

                $invitation->setRelation('inviter', $inviter);

                // Inside the transaction: a failed notification undoes the
                // invitation, including the closing of a lapsed row.
                $this->notifier->notifyInApp($invitation);

                return $invitation;
            });
        } catch (UniqueConstraintViolationException) {
            // A concurrent invite committed first. Caught outside the
            // transaction because PostgreSQL aborts it on a unique violation.
            throw $this->pendingExists();
        }

        // Synchronous (no queue worker) and after the commit, so SMTP latency
        // holds no lock and a mail failure never undoes the invitation.
        try {
            $this->notifier->emailInvitee($invitation);
        } catch (Throwable $e) {
            Log::error('Failed to send organization invitation email', [
                'invitation_id' => $invitation->id,
                'error' => $e->getMessage(),
            ]);
        }

        return $invitation;
    }

    /**
     * Cancels a pending invitation of this organization. The row stays as the
     * audit record. A lapsed pending reads as `expired`, so it is refused and
     * left as stored (revoke never persists the expiry).
     *
     * @throws OrganizationInvitationException
     */
    public function revoke(Organization $organization, int $invitationId): OrganizationInvitation
    {
        return DB::transaction(function () use ($organization, $invitationId) {
            // Lock order: invitation only, the organization row is never taken.
            $invitation = $organization->invitations()
                ->whereKey($invitationId)
                ->lockForUpdate()
                ->first();

            if (! $invitation) {
                throw OrganizationInvitationException::notFound();
            }

            if ($invitation->effective_status !== InvitationStatus::Pending) {
                throw OrganizationInvitationException::unavailable();
            }

            $invitation->update(['status' => InvitationStatus::Cancelled]);

            return $invitation->load('inviter:id,name');
        });
    }

    /**
     * The invitee inbox (huc-14 INV-16): every effective-pending invitation of
     * the user, newest first, then the most recent expired ones. Accepted,
     * rejected and cancelled rows are not part of it. Two portable queries
     * joined in PHP keep it identical on SQLite and PostgreSQL; nothing is
     * written, a lapsed pending row only reads as expired.
     *
     * @return array{invitations: Collection<int, OrganizationInvitation>, pending_count: int}
     */
    public function listForInvitee(User $invitee): array
    {
        $pending = OrganizationInvitation::query()
            ->where('invited_user_id', $invitee->id)
            ->pending()
            ->with(self::INBOX_RELATIONS)
            ->orderByDesc('created_at')
            ->orderByDesc('id')
            ->get();

        $expired = OrganizationInvitation::query()
            ->where('invited_user_id', $invitee->id)
            ->where(fn ($query) => $query
                ->where('status', InvitationStatus::Expired->value)
                ->orWhere(fn ($lapsed) => $lapsed
                    ->where('status', InvitationStatus::Pending->value)
                    ->where('expires_at', '<=', now())))
            ->with(self::INBOX_RELATIONS)
            ->orderByDesc('expires_at')
            ->orderByDesc('id')
            ->limit(self::INBOX_EXPIRED_LIMIT)
            ->get();

        return [
            'invitations' => $pending->concat($expired)->values(),
            'pending_count' => $pending->count(),
        ];
    }

    /**
     * The invitee turns an invitation down (huc-14 INV-18). The row stays as
     * `rejected`. Organization status and account state never matter here, and
     * only the invitation row is locked. A refused attempt writes nothing, so a
     * lapsed pending is left as stored. The admins are told inside the same
     * transaction: a failed notification leaves the invitation pending.
     *
     * @throws OrganizationInvitationException
     */
    public function reject(User $invitee, int $invitationId): OrganizationInvitation
    {
        return DB::transaction(function () use ($invitee, $invitationId) {
            $invitation = $this->lockInvitation($invitee, $invitationId);

            $this->assertOpen($invitation);

            $invitation->update([
                'status' => InvitationStatus::Rejected,
                'responded_at' => now(),
            ]);

            $this->notifier->notifyAdminsOfResponse($invitation, $invitee, InvitationStatus::Rejected);

            return $invitation->load(self::INBOX_RELATIONS);
        });
    }

    /**
     * Scoped to the caller: a foreign and a nonexistent id are the same 404.
     *
     * @throws OrganizationInvitationException
     */
    private function lockInvitation(User $invitee, int $invitationId): OrganizationInvitation
    {
        $invitation = OrganizationInvitation::query()
            ->where('invited_user_id', $invitee->id)
            ->whereKey($invitationId)
            ->lockForUpdate()
            ->first();

        return $invitation ?? throw OrganizationInvitationException::notFound();
    }

    /**
     * Only an effective pending invitation can be answered: a repeat answer
     * says so, a cancelled or lapsed one is simply unavailable.
     *
     * @throws OrganizationInvitationException
     */
    private function assertOpen(OrganizationInvitation $invitation): void
    {
        match ($invitation->effective_status) {
            InvitationStatus::Pending => null,
            InvitationStatus::Accepted, InvitationStatus::Rejected => throw OrganizationInvitationException::alreadyResponded(),
            default => throw OrganizationInvitationException::unavailable(),
        };
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
