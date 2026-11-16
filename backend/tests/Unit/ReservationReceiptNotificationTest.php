<?php

namespace Tests\Unit;

use App\Models\Organization;
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

    private function makeReservation(?int $organizationId = null): Reservations
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
            'organization_id' => $organizationId,
        ])->load(['storeRooms', 'tenants.user', 'organization']);
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

    // -- HUE-05 OR-11/OR-S20/OR-S22: org identity line --

    public function test_to_mail_contains_the_org_identity_line_for_an_organization_reservation()
    {
        $organization = Organization::factory()->create(['name' => 'Andina', 'ruc' => '1790011111001']);
        $reservation = $this->makeReservation($organization->id);
        $notification = new ReservationReceiptNotification($reservation);

        $rendered = $notification->toMail($reservation->tenants->user)->render();

        $this->assertStringContainsString('Reservado a nombre de: Andina (RUC 1790011111001)', $rendered);
    }

    public function test_to_mail_has_no_org_text_for_a_personal_reservation()
    {
        $reservation = $this->makeReservation();
        $notification = new ReservationReceiptNotification($reservation);

        $rendered = $notification->toMail($reservation->tenants->user)->render();

        $this->assertStringNotContainsString('Reservado a nombre de', $rendered);
    }
}
