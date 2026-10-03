<?php

namespace Tests\Feature;

use App\Models\Conversation;
use App\Models\StoreRooms;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

/**
 * POST /api/user persists only the keys declared by the validated rule set and
 * always stores state=active. The endpoint stays public (Decision.tsx).
 */
class UserStoreHardeningTest extends TestCase
{
    use RefreshDatabase;

    public function test_invalid_payload_returns_the_generic_422_shape(): void
    {
        $response = $this->postJson('/api/user', $this->validPayload(['name' => null]));

        $response->assertStatus(422);
        $response->assertJsonPath('message', 'Validation Error');
        $response->assertJsonStructure(['errors' => ['name']]);
        $response->assertJsonMissingPath('status');
    }

    public function test_valid_payload_still_returns_201_with_the_created_item(): void
    {
        $response = $this->postJson('/api/user', $this->validPayload());

        $response->assertStatus(201);
        $response->assertJsonPath('message', 'Item created successfully');
        $this->assertSame('ana@leodega.com', User::findOrFail($response->json('item.id'))->email);
    }

    public function test_anonymous_ratings_key_creates_no_rating_rows(): void
    {
        $room = StoreRooms::factory()->create();
        $before = $this->snapshot('ratings');

        $response = $this->postJson('/api/user', $this->validPayload([
            'ratings' => [['store_id' => $room->id, 'stars' => 5, 'comment' => 'forged']],
        ]));

        $this->assertSame($before, $this->snapshot('ratings'));
        $response->assertStatus(201);
        $this->assertDatabaseHas('user', ['email' => 'ana@leodega.com']);
    }

    public function test_authenticated_reports_key_creates_no_report_rows(): void
    {
        $caller = User::factory()->create(['role' => 'tenant']);
        $room = StoreRooms::factory()->create();
        $before = $this->snapshot('reports');

        $response = $this->bearerAs($caller)->postJson('/api/user', $this->validPayload([
            'reports' => [[
                'store_id' => $room->id,
                'title' => 'forged',
                'report_type' => 'store',
                'description' => 'forged report',
            ]],
        ]));

        $this->assertSame($before, $this->snapshot('reports'));
        $response->assertStatus(201);
    }

    public function test_anonymous_messages_key_creates_no_message_rows(): void
    {
        $conversation = Conversation::factory()->create();
        $before = $this->snapshot('messages');

        $response = $this->postJson('/api/user', $this->validPayload([
            'messages' => [['conversation_id' => $conversation->id, 'body' => 'forged']],
        ]));

        $this->assertSame($before, $this->snapshot('messages'));
        $response->assertStatus(201);
    }

    public function test_admin_and_landlord_keys_create_no_profiles_for_a_tenant(): void
    {
        $before = $this->snapshot('admin');

        $response = $this->postJson('/api/user', $this->validPayload([
            'role' => 'tenant',
            'admin' => [['admin_level' => 2]],
            'landlord' => [['optional_company' => 'forged']],
        ]));

        $this->assertSame($before, $this->snapshot('admin'));
        $this->assertSame([], $this->snapshot('landlords'));
        $response->assertStatus(201);
        $this->assertSame(1, DB::table('tenants')->where('user_id', $response->json('item.id'))->count());
    }

    public function test_state_blocked_is_ignored_and_the_user_is_stored_active(): void
    {
        $response = $this->postJson('/api/user', $this->validPayload(['state' => 'blocked']));

        $this->assertSame('active', User::where('email', 'ana@leodega.com')->value('state'));
        $response->assertStatus(201);
    }

    public function test_omitted_state_is_stored_active(): void
    {
        $response = $this->postJson('/api/user', $this->validPayload());

        $this->assertSame('active', User::where('email', 'ana@leodega.com')->value('state'));
        $response->assertStatus(201);
    }

    public function test_a_user_registered_with_state_blocked_can_log_in(): void
    {
        $this->postJson('/api/user', $this->validPayload(['state' => 'blocked']))->assertStatus(201);

        $response = $this->postJson('/api/login', ['email' => 'ana@leodega.com', 'password' => 'secret123']);

        $response->assertStatus(200);
    }

    private function validPayload(array $overrides = []): array
    {
        return array_merge([
            'name' => 'Ana',
            'lastname' => 'Torres',
            'email' => 'ana@leodega.com',
            'phone' => '0991234567',
            'password' => 'secret123',
            'role' => 'landlord',
            'enable_messages' => true,
        ], $overrides);
    }

    private function snapshot(string $table): array
    {
        return DB::table($table)->orderBy('id')->get()->map(fn ($row) => (array) $row)->all();
    }

    private function bearerAs(User $user): static
    {
        $this->app['auth']->forgetGuards();

        return $this->withToken($user->createToken('auth_token')->plainTextToken);
    }
}
