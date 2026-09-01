<?php

namespace Tests\Feature;

use App\Models\Conversation;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ConversationTest extends TestCase
{
    use RefreshDatabase;

    public function test_index_requires_authentication()
    {
        $response = $this->getJson('/api/conversations');

        $response->assertStatus(401);
    }

    public function test_index_lists_only_conversations_of_authenticated_user()
    {
        $user = User::factory()->create();
        $other = User::factory()->create();
        $stranger = User::factory()->create();

        $mine = Conversation::factory()->create();
        $mine->users()->attach([$user->id, $other->id]);

        $notMine = Conversation::factory()->create();
        $notMine->users()->attach([$other->id, $stranger->id]);

        $response = $this->actingAs($user, 'sanctum')->getJson('/api/conversations');

        $response->assertStatus(200);
        $response->assertJsonCount(1);
        $response->assertJsonPath('0.id', $mine->id);
    }

    public function test_store_creates_new_conversation_between_two_users()
    {
        $user = User::factory()->create();
        $other = User::factory()->create();

        $response = $this->actingAs($user, 'sanctum')->postJson('/api/conversations', [
            'user_id' => $other->id,
        ]);

        // Laravel devuelve 201 automáticamente al retornar un modelo Eloquent
        // recién creado (wasRecentlyCreated) directamente desde el controlador.
        $response->assertStatus(201);
        $this->assertDatabaseHas('conversation_user', ['user_id' => $user->id]);
        $this->assertDatabaseHas('conversation_user', ['user_id' => $other->id]);
    }

    public function test_store_returns_existing_conversation_instead_of_duplicating()
    {
        $user = User::factory()->create();
        $other = User::factory()->create();

        $existing = Conversation::factory()->create();
        $existing->users()->attach([$user->id, $other->id]);

        $response = $this->actingAs($user, 'sanctum')->postJson('/api/conversations', [
            'user_id' => $other->id,
        ]);

        $response->assertStatus(200);
        $response->assertJsonPath('id', $existing->id);
        $this->assertDatabaseCount('conversations', 1);
    }
}
