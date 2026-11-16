<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Organization extends Model
{
    use HasFactory;

    public const DUPLICATE_RUC_MESSAGE = 'Ya existe una organización registrada con este RUC';

    // `logo_path` and `created_by` are written only by OrganizationService;
    // request data never reaches them (StoreOrganizationRequest::validated()
    // carries neither).
    protected $fillable = [
        'name',
        'ruc',
        'email',
        'logo_path',
        'status',
        'created_by',
    ];

    // `wallet_balance` is deliberately not fillable: only WalletService
    // writes it, under a row lock, together with a ledger row.
    protected function casts(): array
    {
        return [
            'wallet_balance' => 'decimal:2',
        ];
    }

    /**
     * @return BelongsToMany<User, $this>
     */
    public function users(): BelongsToMany
    {
        return $this->belongsToMany(User::class, 'organization_user')
            ->withPivot('role', 'monthly_limit', 'joined_at');
    }

    /**
     * @return HasMany<OrganizationWalletMovement, $this>
     */
    public function walletMovements(): HasMany
    {
        return $this->hasMany(OrganizationWalletMovement::class);
    }

    /**
     * @return HasMany<OrganizationInvitation, $this>
     */
    public function invitations(): HasMany
    {
        return $this->hasMany(OrganizationInvitation::class);
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
