<?php

namespace Tests\Feature;

use App\Enums\NotificationType;
use App\Models\Notifications;
use App\Models\User;
use App\Services\NotificationService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class NotificationTest extends TestCase
{
    use RefreshDatabase;

    /** @test */
    public function system_creates_notification_when_event_occurs()
    {
        $sender = User::factory()->create();
        $receiver = User::factory()->create();

        $notification = NotificationService::send(
            $sender->id,
            $receiver->id,
            NotificationType::RESERVATION_REQUEST,
            'Nueva solicitud',
            'Tienes una nueva solicitud',
            ['test' => true]
        );

        $this->assertDatabaseHas('notifications', [
            'id' => $notification->id,
            'sender_id' => $sender->id,
            'receiver_id' => $receiver->id,
            'title' => 'Nueva solicitud',
            'is_read' => false,
        ]);
    }

    /** @test */
    public function user_can_mark_notification_as_read()
    {
        $user = User::factory()->create();

        $notification = Notifications::factory()->create([
            'receiver_id' => $user->id,
            'is_read' => false,
        ]);

        $this->actingAs($user, 'sanctum')
            ->post("/api/notifications/{$notification->id}/read")
            ->assertStatus(200);

        $this->assertDatabaseHas('notifications', [
            'id' => $notification->id,
            'is_read' => true,
        ]);
    }

    /**
     * Fase 1: dos bugs bloqueaban este endpoint hasta ahora:
     *  1. La validación de `receiver_id` usaba `exists:users,id` (tabla
     *     muerta, hallazgo #4 de la matriz de riesgo) en vez de `user,id`.
     *  2. El `use App\NotificationType;` apuntaba a un namespace inexistente
     *     — la clase real es `App\Enums\NotificationType` — así que la
     *     petición fallaba con un error fatal de clase no encontrada.
     * Ambos corregidos; este test prueba que el endpoint HTTP real funciona,
     * no solo NotificationService::send() usado directamente (como en el test
     * de arriba).
     */
    public function test_store_creates_notification_via_http_endpoint()
    {
        $sender = User::factory()->create();
        $receiver = User::factory()->create();

        $response = $this->actingAs($sender, 'sanctum')->postJson('/api/notifications', [
            'receiver_id' => $receiver->id,
            'type' => 'message',
            'title' => 'Tienes un mensaje nuevo',
        ]);

        // Laravel devuelve 201 automáticamente al retornar un modelo Eloquent
        // recién creado (wasRecentlyCreated) directamente desde el controlador.
        $response->assertStatus(201);
        $this->assertDatabaseHas('notifications', [
            'sender_id' => $sender->id,
            'receiver_id' => $receiver->id,
            'title' => 'Tienes un mensaje nuevo',
        ]);
    }
}
