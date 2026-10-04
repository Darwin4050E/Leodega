<?php

namespace Tests\Unit;

use App\Models\Reservations;
use App\Models\StoreRooms;
use App\Models\Tenants;
use App\Models\User;
use App\Notifications\ReservationReceiptNotification;
use App\Support\ReservationCode;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ReservationReceiptNotificationTest extends TestCase
{
    use RefreshDatabase;

    private function makeReservation(): Reservations
    {
        $tenantUser = User::factory()->create(['name' => 'Ana Perez']);
        $tenant = Tenants::factory()->create(['user_id' => $tenantUser->id]);
        $room = StoreRooms::factory()->create(['title' => 'Bodega Central']);

        return Reservations::factory()->create([
            'tenant_id' => $tenant->id,
            'store_room_id' => $room->id,
            'start_date' => '2026-01-10',
            'end_date' => '2026-01-15',
            'total_mount' => 450.00,
        ])->load(['storeRooms', 'tenants.user']);
    }

    public function test_via_returns_mail_only()
    {
        $reservation = $this->makeReservation();
        $notification = new ReservationReceiptNotification($reservation);

        $this->assertSame(['mail'], $notification->via($reservation->tenants->user));
    }

    public function test_to_mail_contains_reservation_details()
    {
        $reservation = $this->makeReservation();
        $notification = new ReservationReceiptNotification($reservation);

        $mail = $notification->toMail($reservation->tenants->user);
        $rendered = $mail->render();

        $this->assertSame('Confirmación de tu reserva - Leodega', $mail->subject);
        $this->assertStringContainsString('Ana Perez', $rendered);
        $this->assertStringContainsString(ReservationCode::format($reservation->id), $rendered);
        $this->assertStringContainsString('Bodega Central', $rendered);
        $this->assertStringContainsString('$450.00', $rendered);
    }
}
