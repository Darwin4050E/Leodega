<?php

namespace Tests\Feature;

use App\Models\Landlords;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class StoreRoomTest extends TestCase
{
    use RefreshDatabase; // Limpia la base de datos de memoria en cada ejecución

    /**
     * TC-B-01: Creación de bodega con datos válidos
     */
    public function test_landlord_can_create_store_room_with_valid_data()
    {
        $user = User::factory()->create(['role' => 'landlord']);
        $landlord = Landlords::factory()->create([
            'user_id' => $user->id,
        ]);

        $response = $this->actingAs($user, 'sanctum')
            ->postJson('/api/storeRooms', [
                'landlord_id' => $landlord->id,
                'room_type' => 'bodega',
                'storage_type' => 'completa',
                'direction' => 'Av. Carlos Julio Arosemena',
                'city' => 'Guayaquil',
                'size' => 45.5,
                'title' => 'Bodega Central Norte',
                'description' => 'Espacio amplio',
                'security' => 'Alta',
                'publication_status' => 'pending',
            ]);

        $response->assertStatus(201);

        $this->assertDatabaseHas('storeRooms', [
            'title' => 'Bodega Central Norte',
            'landlord_id' => $landlord->id,
        ]);
    }

    /**
     * TC-B-03: Validación de tamaño (size) debe ser numérico
     */
    public function test_create_store_room_fails_if_size_is_not_numeric()
    {
        /** @var \App\Models\User $user */
        $user = User::factory()->create(['role' => 'landlord']);

        $landlord = Landlords::create(['user_id' => $user->id]);

        $response = $this->actingAs($user, 'sanctum')->postJson('/api/storeRooms', [
            'landlord_id' => $landlord->id,
            'size' => 'un-texto-invalido',
            'room_type' => 'bodega',
            'storage_type' => 'completa', // Agregado para cumplir con validación store
            'direction' => 'Calle Falsa 123',
            'city' => 'Guayaquil',
            'title' => 'Prueba Fallida',
            'description' => 'Test de validación',
            'security' => 'Alta',
        ]);

        $response->assertStatus(400);
        $response->assertJsonValidationErrors(['size']);
    }

    /**
     * TC-B-04: Seguridad - No se puede crear sin estar autenticado
     */
    public function test_cannot_create_store_room_without_authentication()
    {
        $response = $this->postJson('/api/storeRooms', [
            'title' => 'Intento fallido',
        ]);

        $response->assertStatus(401);
    }
}
