<?php

namespace Tests\Unit;

use App\Models\User;
use App\Services\AuthService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Request;
use Tests\TestCase;

class AuthServiceTest extends TestCase
{
    use RefreshDatabase;

    public function test_issue_token_for_creates_a_usable_token()
    {
        $user = User::factory()->create();
        $request = Request::create('/api/login', 'POST', [], [], [], [
            'REMOTE_ADDR' => '10.0.0.1',
            'HTTP_USER_AGENT' => 'PHPUnit',
        ]);

        $token = (new AuthService)->issueTokenFor($user, $request);

        $this->assertIsString($token);
        $this->assertDatabaseCount('personal_access_tokens', 1);
    }

    public function test_issue_token_for_saves_ip_and_user_agent_on_the_token()
    {
        $user = User::factory()->create();
        $request = Request::create('/api/login', 'POST', [], [], [], [
            'REMOTE_ADDR' => '10.0.0.1',
            'HTTP_USER_AGENT' => 'PHPUnit',
        ]);

        (new AuthService)->issueTokenFor($user, $request);

        $this->assertDatabaseHas('personal_access_tokens', [
            'tokenable_id' => $user->id,
            'ip_address' => '10.0.0.1',
            'user_agent' => 'PHPUnit',
        ]);
    }
}
