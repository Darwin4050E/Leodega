<?php

namespace Tests\Feature;

use App\Models\Conversation;
use App\Models\Message;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class MessageTest extends TestCase
{
    use RefreshDatabase;

    /** @test */
    public function tenant_can_send_message_to_landlord()
    {
        // Tenant
        $tenantUser = User::factory()->create(['role' => 'tenant']);
        // Landlord
        $landlordUser = User::factory()->create(['role' => 'landlord']);

        $conversation = Conversation::factory()
            ->withUsers($tenantUser, $landlordUser)
            ->create();

        $response = $this->actingAs($tenantUser, 'sanctum')
            ->postJson("/api/conversations/{$conversation->id}/messages", [
                'body' => 'Hola, estoy interesado en la bodega',
            ]);

        $response->assertStatus(201);

        $this->assertDatabaseHas('messages', [
            'conversation_id' => $conversation->id,
            'sender_id' => $tenantUser->id,
            'body' => 'Hola, estoy interesado en la bodega',
        ]);
    }

    /** @test */
    public function user_cannot_read_messages_of_conversation_where_is_not_participant()
    {
        $tenantUser = User::factory()->create(['role' => 'tenant']);
        $landlordUser = User::factory()->create(['role' => 'landlord']);
        $outsider = User::factory()->create();

        $conversation = Conversation::factory()
            ->withUsers($tenantUser, $landlordUser)
            ->create();

        Message::factory()->create([
            'conversation_id' => $conversation->id,
            'sender_id' => $tenantUser->id,
            'body' => 'Mensaje privado',
        ]);

        $response = $this->actingAs($outsider, 'sanctum')
            ->getJson("/api/conversations/{$conversation->id}/messages");

        $response->assertStatus(403);
    }
}
