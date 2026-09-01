<?php

namespace Tests\Unit;

use App\Models\Landlords;
use App\Models\StoreRooms;
use App\Models\User;
use App\Services\ReportService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ReportServiceTest extends TestCase
{
    use RefreshDatabase;

    public function test_create_persists_report_and_notifies_all_admins()
    {
        $reporter = User::factory()->create(['role' => 'tenant']);
        $admin1 = User::factory()->create(['role' => 'admin']);
        $admin2 = User::factory()->create(['role' => 'admin']);
        $store = StoreRooms::factory()->create();

        $report = (new ReportService)->create($reporter->id, [
            'store_id' => $store->id,
            'title' => 'Bodega en mal estado',
            'priority' => 'high',
            'report_type' => 'store',
            'description' => 'Descripción del problema encontrado.',
        ]);

        $this->assertDatabaseHas('reports', [
            'id' => $report->id,
            'user_id' => $reporter->id,
            'store_id' => $store->id,
            'status' => 'pending',
        ]);

        $this->assertDatabaseHas('notifications', [
            'receiver_id' => $admin1->id,
            'type' => 'store_reported',
        ]);
        $this->assertDatabaseHas('notifications', [
            'receiver_id' => $admin2->id,
            'type' => 'store_reported',
        ]);
    }

    public function test_create_also_notifies_the_landlord_who_owns_the_store()
    {
        $reporter = User::factory()->create(['role' => 'tenant']);
        $landlordUser = User::factory()->create(['role' => 'landlord']);
        $landlord = Landlords::factory()->create(['user_id' => $landlordUser->id]);
        $store = StoreRooms::factory()->create(['landlord_id' => $landlord->id]);

        (new ReportService)->create($reporter->id, [
            'store_id' => $store->id,
            'title' => 'Bodega en mal estado',
            'priority' => 'high',
            'report_type' => 'store',
            'description' => 'Descripción del problema encontrado.',
        ]);

        $this->assertDatabaseHas('notifications', [
            'receiver_id' => $landlordUser->id,
            'type' => 'store_reported',
        ]);
    }

    /**
     * Caso borde: si el dueño de la bodega también es admin, no debe recibir
     * la notificación duplicada (una como admin, otra como landlord).
     */
    public function test_landlord_who_is_also_admin_is_not_notified_twice()
    {
        $reporter = User::factory()->create(['role' => 'tenant']);
        $landlordAdminUser = User::factory()->create(['role' => 'admin']);
        $landlord = Landlords::factory()->create(['user_id' => $landlordAdminUser->id]);
        $store = StoreRooms::factory()->create(['landlord_id' => $landlord->id]);

        (new ReportService)->create($reporter->id, [
            'store_id' => $store->id,
            'title' => 'Bodega en mal estado',
            'priority' => 'high',
            'report_type' => 'store',
            'description' => 'Descripción del problema encontrado.',
        ]);

        $this->assertDatabaseCount('notifications', 1);
    }
}
