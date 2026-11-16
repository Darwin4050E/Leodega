<?php

namespace App\Models;

use App\Enums\OrganizationRole;
use App\Notifications\ResetPasswordNotification;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Illuminate\Support\Facades\DB;
use Laravel\Sanctum\HasApiTokens;

class User extends Authenticatable
{
    use HasApiTokens;
    use HasFactory;
    use Notifiable;

    protected $table = 'user';

    protected $fillable = [
        'name',
        'lastname',
        'email',
        'phone',
        'password',
        'role',
        'start_date',
        'state',
        'enable_messages',
    ];

    protected $hidden = [
        'password',
        'remember_token',
    ];

    public function setPasswordAttribute($value)
    {
        if (! $value || (strlen($value) === 60 && preg_match('/^\$2y\$/', $value))) {
            $this->attributes['password'] = $value;

            return;
        }
        $this->attributes['password'] = bcrypt($value);
    }

    public function sendPasswordResetNotification($token)
    {
        $this->notify(new ResetPasswordNotification($token, $this->email));
    }

    // Relation with Landlords
    /**
     * @return HasOne<Landlords, $this>
     */
    public function landlord(): HasOne
    {
        return $this->hasOne(Landlords::class, 'user_id');
    }

    /**
     * @return HasOne<Tenants, $this>
     */
    public function tenant(): HasOne
    {
        return $this->hasOne(Tenants::class, 'user_id');
    }

    /**
     * @return HasMany<Notifications, $this>
     */
    public function sendNotifications(): HasMany
    {
        return $this->hasMany(Notifications::class, 'emisor_id');
    }

    /**
     * @return HasMany<Notifications, $this>
     */
    public function receivedNotifications(): HasMany
    {
        return $this->hasMany(Notifications::class, 'receptor_id');
    }

    /**
     * @return HasMany<Ratings, $this>
     */
    public function ratings(): HasMany
    {
        return $this->hasMany(Ratings::class, 'user_id');
    }

    /**
     * @return HasMany<Reports, $this>
     */
    public function reports(): HasMany
    {
        return $this->hasMany(Reports::class, 'user_id');
    }

    /**
     * @return HasOne<Admin, $this>
     */
    public function admin(): HasOne
    {
        return $this->hasOne(Admin::class, 'user_id');
    }

    /**
     * @return BelongsToMany<Conversation, $this>
     */
    public function conversations(): BelongsToMany
    {
        return $this->belongsToMany(Conversation::class, 'conversation_user');
    }

    /**
     * @return HasMany<Message, $this>
     */
    public function messages(): HasMany
    {
        return $this->hasMany(Message::class, 'sender_id');
    }

    /**
     * @return BelongsToMany<Organization, $this>
     */
    public function organizations(): BelongsToMany
    {
        return $this->belongsToMany(Organization::class, 'organization_user')
            ->withPivot('role', 'monthly_limit', 'joined_at');
    }

    /**
     * Live pivot role, read on every call (never cached) so a demotion applies
     * immediately. Null when the user does not belong to the organization.
     */
    public function roleInOrganization(int $organizationId): ?OrganizationRole
    {
        $role = DB::table('organization_user')
            ->where('user_id', $this->id)
            ->where('organization_id', $organizationId)
            ->value('role');

        return OrganizationRole::tryFrom((string) $role);
    }
}
