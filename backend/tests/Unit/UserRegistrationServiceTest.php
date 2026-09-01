<?php

namespace Tests\Unit;

use App\Models\Landlords;
use App\Models\Tenants;
use App\Models\User;
use App\Services\UserRegistrationService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class UserRegistrationServiceTest extends TestCase
{
    use RefreshDatabase;

    public function test_creates_landlord_profile_for_landlord_role()
    {
        $user = User::factory()->create(['role' => 'landlord']);

        (new UserRegistrationService)->createProfileForRole($user);

        $this->assertTrue(Landlords::where('user_id', $user->id)->exists());
        $this->assertFalse(Tenants::where('user_id', $user->id)->exists());
    }

    public function test_creates_tenant_profile_for_tenant_role()
    {
        $user = User::factory()->create(['role' => 'tenant']);

        (new UserRegistrationService)->createProfileForRole($user);

        $this->assertTrue(Tenants::where('user_id', $user->id)->exists());
        $this->assertFalse(Landlords::where('user_id', $user->id)->exists());
    }

    public function test_creates_no_profile_for_admin_role()
    {
        $user = User::factory()->create(['role' => 'admin']);

        (new UserRegistrationService)->createProfileForRole($user);

        $this->assertFalse(Landlords::where('user_id', $user->id)->exists());
        $this->assertFalse(Tenants::where('user_id', $user->id)->exists());
    }
}
