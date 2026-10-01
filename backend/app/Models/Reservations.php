<?php

namespace App\Models;

use Carbon\Carbon;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Reservations extends Model
{
    //
    use HasFactory;

    protected $table = 'reservations';

    protected $fillable = [
        'store_room_id',
        'tenant_id',
        'start_date',
        'end_date',
        'status',
        'total_mount',
        'rent_subtotal',
        'cancelation_reason',
        'creation_date',
        'cancellation_policy_tier',
        'refund_amount',
    ];

    public function storeRooms()
    {
        return $this->belongsTo(StoreRooms::class, 'store_room_id');
    }

    public function tenants()
    {
        return $this->belongsTo(Tenants::class, 'tenant_id');
    }

    public function payments()
    {
        return $this->hasMany(Payments::class, 'reservation_id');
    }

    public function cancellationObligation()
    {
        return $this->hasOne(ReservationCancellationObligation::class, 'reservation_id');
    }

    /**
     * Most recent 'paid' Payments row, by id (insertion order) rather than
     * payment_date, which is client-suppliable and not guaranteed monotonic.
     */
    public function latestPaidPayment(): ?Payments
    {
        return $this->payments->sortByDesc('id')->firstWhere('payment_state', 'paid');
    }

    /**
     * Single definition of the HUG-06 gestor cancellation rule: the
     * reservation must be paid (`confirmed` is only reachable from
     * PaymentService's paid branch), priced (legacy rows have a null
     * rent_subtotal and cannot be refunded), and not yet started —
     * strictly future, so a reservation beginning today is NOT cancellable.
     *
     * Both ReservationService::cancelByLandlord()'s guard and
     * landlordIndex()'s `can_be_cancelled` flag call this. Writing the rule
     * twice is exactly how a UI ends up enabling a button the server then
     * rejects with 409 — and the client cannot compute it on its own,
     * because it does not know what "today" is on the server.
     */
    public function isCancellableByLandlord(): bool
    {
        return $this->status === 'confirmed'
            && $this->rent_subtotal !== null
            && Carbon::parse($this->start_date)->startOfDay()->gt(today());
    }

    /**
     * sdd/tenant-self-cancel reconciliation #2: mirrors
     * isCancellableByLandlord()'s date gate EXACTLY (`start_date > today()`,
     * server-side date-only `today()`) so a reservation whose start date is
     * reached or passed is never cancellable via this path either, even
     * though the tenant path also allows `pending` (unpaid) reservations,
     * which the landlord path does not.
     */
    public function isCancellableByTenant(): bool
    {
        return in_array($this->status, ['pending', 'confirmed'], true)
            && Carbon::parse($this->start_date)->startOfDay()->gt(today());
    }

    /**
     * sdd/hug02-payment-hold-expiry: single definition of the payment-hold
     * cutoff instant (`now() - payment_hold_minutes`). Every caller that
     * needs to reason about hold expiry -- scopeActiveHold,
     * scopeExpiredHold, isExpiredHold() -- routes through this one method,
     * so the single tunable (config key, `now()`) lives in one place and
     * `Carbon::setTestNow()`/`$this->travel()` control every caller
     * identically.
     */
    public function holdCutoff(): Carbon
    {
        return now()->subMinutes((int) config('reservations.payment_hold_minutes'));
    }

    /**
     * `pending` rows whose hold has NOT elapsed: `created_at` strictly
     * after the cutoff instant. Exclusive boundary -- a row created
     * EXACTLY at the cutoff is EXPIRED, not active (see scopeExpiredHold).
     */
    public function scopeActiveHold(Builder $query): Builder
    {
        return $query->where('status', 'pending')
            ->where('created_at', '>', $this->holdCutoff());
    }

    /**
     * `pending` rows whose hold HAS elapsed: `created_at` at or before the
     * cutoff instant. Mirrors scopeActiveHold()'s boundary exactly so the
     * two scopes partition every `pending` row with no gap and no overlap.
     */
    public function scopeExpiredHold(Builder $query): Builder
    {
        return $query->where('status', 'pending')
            ->where('created_at', '<=', $this->holdCutoff());
    }

    /**
     * Instance-level mirror of scopeExpiredHold()'s time boundary, for a
     * single already-fetched row (e.g. PaymentService's locked row) where
     * running a new query is unnecessary. Time-only check -- callers decide
     * whether `status === 'pending'` also matters.
     */
    public function isExpiredHold(): bool
    {
        return Carbon::parse($this->created_at)->lte($this->holdCutoff());
    }
}
