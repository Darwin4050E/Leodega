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

    public function users()
    {
        return $this->belongsToMany(User::class, 'organization_user')
            ->withPivot('role', 'joined_at');
    }

    public function creator()
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
