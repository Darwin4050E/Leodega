<?php

namespace Database\Seeders;

use App\Models\Landlords;
use App\Models\Reservations;
use App\Models\StorePrices;
use App\Models\StoreRooms;
use App\Models\Tenants;
use App\Models\User;
use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;

/**
 * Demo data for local development and staging: two gestores, two clientes,
 * listings across every publication state, and a couple of confirmed
 * reservations. Everything is keyed by a stable natural key (email, or
 * landlord + title) with firstOrCreate, so `php artisan db:seed` can be run
 * repeatedly without duplicating rows.
 *
 * Never runs in production — DatabaseSeeder guards the call by environment.
 *
 * Fixed credentials:
 *   admin@leodega.com   / admin123    (AdminUserSeeder)
 *   gestor@leodega.com  / gestor123
 *   gestor2@leodega.com / gestor123
 *   cliente@leodega.com  / cliente123
 *   cliente2@leodega.com / cliente123
 */
class DemoDataSeeder extends Seeder
{
    use WithoutModelEvents;

    public function run(): void
    {
        $gestor1 = $this->landlord('Marta', 'Rivas', 'gestor@leodega.com');
        $gestor2 = $this->landlord('Luis', 'Peña', 'gestor2@leodega.com');

        $cliente1 = $this->tenant('Ana', 'Torres', 'cliente@leodega.com');
        $cliente2 = $this->tenant('Diego', 'Salas', 'cliente2@leodega.com');

        // [landlord, title, publication_status, monthly price, size m², city, direction]
        $definitions = [
            [$gestor1, 'Bodega Vía a Daule', 'approved', 780, 420, 'Guayaquil', 'Km 11.5 Vía a Daule'],
            [$gestor1, 'Galpón Logístico Centro', 'approved', 540, 260, 'Guayaquil', 'Av. Domingo Comín 402'],
            [$gestor1, 'Bodega Sur Km 16', 'pending', 610, 340, 'Guayaquil', 'Km 16 Vía a la Costa'],
            [$gestor2, 'Mini Storage Urdesa', 'approved', 160, 18, 'Guayaquil', 'Calle Circunvalación 120'],
            [$gestor2, 'Depósito Mapasingue', 'pending', 300, 120, 'Guayaquil', 'Av. 2da y Callejón 11'],
            [$gestor2, 'Galpón Samborondón', 'rejected', 920, 360, 'Samborondón', 'Km 3 Vía Samborondón'],
        ];

        $rooms = [];
        foreach ($definitions as [$landlord, $title, $status, $price, $size, $city, $direction]) {
            $rooms[$title] = $this->room($landlord, $title, $status, $price, $size, $city, $direction);
        }

        $this->reservation($rooms['Bodega Vía a Daule'], $cliente1, now()->addWeek(), now()->addMonths(4));
        $this->reservation($rooms['Mini Storage Urdesa'], $cliente2, now()->addDays(3), now()->addMonths(2));
    }

    private function landlord(string $name, string $lastname, string $email): Landlords
    {
        $user = $this->user($name, $lastname, $email, 'landlord', 'gestor123');

        return Landlords::firstOrCreate(['user_id' => $user->id], ['optional_company' => null]);
    }

    private function tenant(string $name, string $lastname, string $email): Tenants
    {
        $user = $this->user($name, $lastname, $email, 'tenant', 'cliente123');

        return Tenants::firstOrCreate(['user_id' => $user->id], ['search_preference' => 'price']);
    }

    private function user(string $name, string $lastname, string $email, string $role, string $password): User
    {
        return User::firstOrCreate(
            ['email' => $email],
            [
                'name' => $name,
                'lastname' => $lastname,
                'phone' => fake()->numerify('09########'),
                // hashed by User::setPasswordAttribute
                'password' => $password,
                'role' => $role,
                'state' => 'active',
            ],
        );
    }

    private function room(
        Landlords $landlord,
        string $title,
        string $status,
        int $price,
        int $size,
        string $city,
        string $direction,
    ): StoreRooms {
        $room = StoreRooms::firstOrCreate(
            ['landlord_id' => $landlord->id, 'title' => $title],
            [
                'room_type' => 'bodega',
                'storage_type' => 'completa',
                'direction' => $direction,
                'city' => $city,
                'size' => $size,
                'description' => 'Espacio de demostración generado por DemoDataSeeder.',
                'security' => json_encode(['camara' => true, 'acceso' => true]),
                'publication_status' => $status,
                // Placeholder path — no real file on disk for demo listings.
                'firefighter_permit_path' => 'firefighter_permits/demo-permiso.pdf',
                'cancellation_policy_tier' => 'flexible',
            ],
        );

        StorePrices::firstOrCreate(
            ['store_room_id' => $room->id, 'mode' => 'month'],
            ['price' => $price, 'disponibility' => true],
        );

        return $room;
    }

    private function reservation(
        StoreRooms $room,
        Tenants $tenant,
        \DateTimeInterface $start,
        \DateTimeInterface $end,
    ): void {
        $monthly = (float) $room->storePrices()->where('mode', 'month')->value('price');

        Reservations::firstOrCreate(
            ['store_room_id' => $room->id, 'tenant_id' => $tenant->id],
            [
                'start_date' => $start,
                'end_date' => $end,
                'status' => 'confirmed',
                'total_mount' => $monthly,
                'rent_subtotal' => round($monthly * 0.9, 2),
                'creation_date' => now(),
            ],
        );
    }
}
