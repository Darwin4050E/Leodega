<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

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

    public function users()
    {
        return $this->belongsToMany(User::class, 'organization_user')
            ->withPivot('role', 'joined_at');
    }

    public function walletMovements()
    {
        return $this->hasMany(OrganizationWalletMovement::class);
    }

    public function creator()
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
