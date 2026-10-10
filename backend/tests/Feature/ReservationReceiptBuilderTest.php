<?php

namespace Tests\Feature;

use App\Models\Landlords;
use App\Models\Organization;
use App\Models\Payments;
use App\Models\Reservations;
use App\Models\StoreRooms;
use App\Models\User;
use App\Support\ReservationReceipt;
use Carbon\Carbon;
use Carbon\CarbonInterface;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * sdd/huc05-payment-receipt: ReservationReceipt::build() is the single
 * source for the tenantIndex `receipt` payload and the PDF view.
 */
class ReservationReceiptBuilderTest extends TestCase
{
    use RefreshDatabase;

    private function reservation(array $overrides = [], array $roomOverrides = [], ?User $gestor = null): Reservations
    {
        $gestor ??= User::factory()->create(['name' => 'Ana', 'lastname' => 'Pérez', 'role' => 'landlord']);
        $landlord = Landlords::factory()->create(['user_id' => $gestor->id]);
        $room = StoreRooms::factory()->approved()->create(array_merge([
            'landlord_id' => $landlord->id,
            'title' => 'Bodega Centro',
        ], $roomOverrides));

        return Reservations::factory()->create(array_merge([
            'id' => 123,
            'store_room_id' => $room->id,
            'status' => 'confirmed',
            'start_date' => '2026-10-10',
            'end_date' => '2026-11-10',
            'total_mount' => 1850,
        ], $overrides));
    }

    private function payment(Reservations $reservation, array $overrides = []): Payments
    {
        return Payments::factory()->create(array_merge([
            'reservation_id' => $reservation->id,
            'payment_state' => 'paid',
            'payment_method' => 'credit card',
            'created_at' => '2026-10-02 03:30:00',
        ], $overrides));
    }

    public function test_build_returns_the_twelve_receipt_keys_for_a_confirmed_paid_reservation()
    {
        $reservation = $this->reservation();
        $payment = $this->payment($reservation);

        $receipt = ReservationReceipt::build($reservation);

        $this->assertSame([
            'code' => 'LEO-000123',
            'status_label' => 'CONFIRMADA',
            'store_room_title' => 'Bodega Centro',
            'gestor_name' => 'Ana Pérez',
            'start_date' => '2026-10-10',
            'end_date' => '2026-11-10',
            'total_paid' => '1850.00',
            'payment_id' => $payment->id,
            'payment_method' => 'credit card',
            'payment_method_label' => 'Tarjeta de crédito',
            'paid_at' => $receipt['paid_at'],
            'paid_at_label' => $receipt['paid_at_label'],
            'organization_name' => null,
            'organization_ruc' => null,
        ], $receipt);
        $this->assertNotEmpty($receipt['paid_at']);
        $this->assertNotEmpty($receipt['paid_at_label']);
    }

    public function test_build_returns_null_for_a_pending_reservation_with_a_paid_row()
    {
        $reservation = $this->reservation(['status' => 'pending']);
        $this->payment($reservation);

        $this->assertNull(ReservationReceipt::build($reservation));
    }

    public function test_build_returns_null_for_a_canceled_reservation_with_a_prior_paid_row()
    {
        $reservation = $this->reservation(['status' => 'canceled']);
        $this->payment($reservation);

        $this->assertNull(ReservationReceipt::build($reservation));
    }

    public function test_build_returns_null_for_a_confirmed_reservation_without_payments()
    {
        $reservation = $this->reservation();

        $this->assertNull(ReservationReceipt::build($reservation));
    }

    public function test_build_returns_null_for_a_confirmed_reservation_with_only_pending_or_failed_rows()
    {
        $reservation = $this->reservation();
        $this->payment($reservation, ['payment_state' => 'pending']);
        $this->payment($reservation, ['payment_state' => 'failed']);

        $this->assertNull(ReservationReceipt::build($reservation));
    }

    public function test_build_uses_the_paid_row_when_a_later_failed_row_exists()
    {
        $reservation = $this->reservation();
        $paid = $this->payment($reservation, ['payment_method' => 'debit card']);
        $this->payment($reservation, ['payment_state' => 'failed', 'payment_method' => 'credit card']);

        $receipt = ReservationReceipt::build($reservation);

        $this->assertSame($paid->id, $receipt['payment_id']);
        $this->assertSame('debit card', $receipt['payment_method']);
        $this->assertSame('Tarjeta de débito', $receipt['payment_method_label']);
    }

    public function test_build_uses_the_highest_id_when_two_paid_rows_exist()
    {
        $reservation = $this->reservation();
        $this->payment($reservation, ['payment_method' => 'credit card', 'created_at' => '2026-10-05 12:00:00']);
        $latest = $this->payment($reservation, ['payment_method' => 'debit card', 'created_at' => '2026-10-01 12:00:00']);

        $receipt = ReservationReceipt::build($reservation);

        $this->assertSame($latest->id, $receipt['payment_id']);
        $this->assertSame('debit card', $receipt['payment_method']);
    }

    public function test_build_returns_the_receipt_for_a_finished_confirmed_paid_reservation()
    {
        $reservation = $this->reservation([
            'start_date' => '2025-01-10',
            'end_date' => '2025-02-10',
        ]);
        $this->payment($reservation);

        $receipt = ReservationReceipt::build($reservation);

        $this->assertSame('LEO-000123', $receipt['code']);
        $this->assertSame('2025-02-10', $receipt['end_date']);
    }

    private function receiptPaidAt(CarbonInterface $createdAt): array
    {
        $reservation = $this->reservation(['id' => random_int(1000, 999999)]);
        $payment = (new Payments)->forceFill([
            'id' => 1,
            'reservation_id' => $reservation->id,
            'payment_state' => 'paid',
            'payment_method' => 'credit card',
            'created_at' => $createdAt->copy()->setTimezone(date_default_timezone_get()),
        ]);
        $reservation->setRelation('payments', collect([$payment]));

        $receipt = ReservationReceipt::build($reservation);

        return [$receipt['paid_at'], $receipt['paid_at_label']];
    }

    private function withPhpTimezone(string $timezone, callable $callback): void
    {
        $original = date_default_timezone_get();
        date_default_timezone_set($timezone);

        try {
            $callback();
        } finally {
            date_default_timezone_set($original);
        }
    }

    public function test_paid_at_is_converted_to_guayaquil_regardless_of_the_php_timezone()
    {
        $this->withPhpTimezone('Asia/Tokyo', function () {
            [$paidAt, $label] = $this->receiptPaidAt(Carbon::parse('2026-10-02 03:30:00', 'UTC'));

            $this->assertSame('2026-10-01T22:30:00-05:00', $paidAt);
            $this->assertSame('1 oct 2026, 22:30', $label);
        });
    }

    public function test_paid_at_is_converted_once_when_app_and_php_timezones_are_guayaquil()
    {
        config(['app.timezone' => 'America/Guayaquil']);

        $this->withPhpTimezone('America/Guayaquil', function () {
            [$paidAt, $label] = $this->receiptPaidAt(Carbon::parse('2026-10-02 03:30:00', 'UTC'));

            $this->assertSame('2026-10-01T22:30:00-05:00', $paidAt);
            $this->assertSame('1 oct 2026, 22:30', $label);
        });
    }

    public function test_paid_at_crosses_the_guayaquil_midnight_boundary_exactly_at_0500_utc()
    {
        [$beforePaidAt, $beforeLabel] = $this->receiptPaidAt(Carbon::parse('2026-10-02 04:59:59', 'UTC'));
        [$afterPaidAt, $afterLabel] = $this->receiptPaidAt(Carbon::parse('2026-10-02 05:00:00', 'UTC'));

        $this->assertSame('2026-10-01T23:59:59-05:00', $beforePaidAt);
        $this->assertSame('1 oct 2026, 23:59', $beforeLabel);
        $this->assertSame('2026-10-02T00:00:00-05:00', $afterPaidAt);
        $this->assertSame('2 oct 2026, 00:00', $afterLabel);
    }

    public function test_the_same_instant_supplied_in_guayaquil_time_yields_identical_output()
    {
        $inUtc = $this->receiptPaidAt(Carbon::parse('2026-10-02 04:59:59', 'UTC'));
        $inGuayaquil = $this->receiptPaidAt(Carbon::parse('2026-10-01 23:59:59', 'America/Guayaquil'));

        $this->assertSame($inUtc, $inGuayaquil);
        $this->assertSame('1 oct 2026, 23:59', $inGuayaquil[1]);
    }

    public function test_gestor_name_is_null_when_the_room_has_no_landlord()
    {
        $reservation = $this->reservation();
        $this->payment($reservation);
        $reservation->load('storeRooms');
        $reservation->storeRooms->setRelation('landlord', null);

        $receipt = ReservationReceipt::build($reservation);

        $this->assertSame('LEO-000123', $receipt['code']);
        $this->assertNull($receipt['gestor_name']);
    }

    public function test_gestor_name_is_the_trimmed_name_and_lastname()
    {
        $gestor = User::factory()->create(['name' => 'Ana', 'lastname' => '', 'role' => 'landlord']);
        $reservation = $this->reservation([], [], $gestor);
        $this->payment($reservation);

        $this->assertSame('Ana', ReservationReceipt::build($reservation)['gestor_name']);
    }

    public function test_method_fields_are_null_when_the_paid_row_has_no_payment_method()
    {
        $reservation = $this->reservation();
        $payment = (new Payments)->forceFill([
            'id' => 9,
            'reservation_id' => $reservation->id,
            'payment_state' => 'paid',
            'payment_method' => null,
            'created_at' => Carbon::parse('2026-10-02 03:30:00', 'UTC'),
        ]);
        $reservation->setRelation('payments', collect([$payment]));

        $receipt = ReservationReceipt::build($reservation);

        $this->assertSame(9, $receipt['payment_id']);
        $this->assertNull($receipt['payment_method']);
        $this->assertNull($receipt['payment_method_label']);
    }

    private function renderPdfView(array $receipt): string
    {
        return view('pdf.reservation-receipt', ['receipt' => $receipt])->render();
    }

    public function test_pdf_view_prints_the_eight_receipt_values()
    {
        $reservation = $this->reservation();
        $this->payment($reservation);

        $html = $this->renderPdfView(ReservationReceipt::build($reservation));

        $this->assertStringContainsString('LEO-000123', $html);
        $this->assertStringContainsString('Bodega Centro', $html);
        $this->assertStringContainsString('Ana Pérez', $html);
        $this->assertStringContainsString('2026-10-10', $html);
        $this->assertStringContainsString('2026-11-10', $html);
        $this->assertStringContainsString('$1,850.00 USD', $html);
        $this->assertStringContainsString('1 oct 2026, 22:30', $html);
        $this->assertStringContainsString('CONFIRMADA', $html);
        $this->assertStringContainsString('Tarjeta de crédito', $html);
    }

    // -- HUE-05 OR-10/OR-S17/OR-S19: org identity on payload and PDF --

    public function test_build_includes_the_live_org_name_and_ruc_for_an_organization_reservation()
    {
        $organization = Organization::factory()->create(['name' => 'Andina', 'ruc' => '1790011111001']);
        $reservation = $this->reservation(['organization_id' => $organization->id]);
        $this->payment($reservation);

        $receipt = ReservationReceipt::build($reservation);

        $this->assertSame('Andina', $receipt['organization_name']);
        $this->assertSame('1790011111001', $receipt['organization_ruc']);
    }

    public function test_build_has_null_org_fields_for_a_personal_reservation()
    {
        $reservation = $this->reservation(['organization_id' => null]);
        $this->payment($reservation);

        $receipt = ReservationReceipt::build($reservation);

        $this->assertNull($receipt['organization_name']);
        $this->assertNull($receipt['organization_ruc']);
    }

    public function test_pdf_view_shows_the_org_row_for_an_organization_reservation()
    {
        $organization = Organization::factory()->create(['name' => 'Andina', 'ruc' => '1790011111001']);
        $reservation = $this->reservation(['organization_id' => $organization->id]);
        $this->payment($reservation);

        $html = $this->renderPdfView(ReservationReceipt::build($reservation));

        $this->assertStringContainsString('Reservado a nombre de: Andina (RUC 1790011111001)', $html);
    }

    public function test_pdf_view_omits_the_org_row_for_a_personal_reservation()
    {
        $reservation = $this->reservation(['organization_id' => null]);
        $this->payment($reservation);

        $html = $this->renderPdfView(ReservationReceipt::build($reservation));

        $this->assertStringNotContainsString('Reservado a nombre de', $html);
    }

    // -- org-wallet OR-10/OR-S17/OR-S19/OR-S28: wallet payment label --

    public function test_build_labels_a_wallet_payment_with_the_live_org_name()
    {
        $organization = Organization::factory()->create(['name' => 'Andina', 'ruc' => '1790011111001']);
        $reservation = $this->reservation(['organization_id' => $organization->id]);
        $this->payment($reservation, ['payment_method' => 'wallet']);

        $receipt = ReservationReceipt::build($reservation);

        $this->assertSame('wallet', $receipt['payment_method']);
        $this->assertSame('Saldo de Andina', $receipt['payment_method_label']);
    }

    public function test_the_wallet_label_follows_an_org_rename_after_payment()
    {
        $organization = Organization::factory()->create(['name' => 'Andina']);
        $reservation = $this->reservation(['organization_id' => $organization->id]);
        $this->payment($reservation, ['payment_method' => 'wallet']);
        $organization->update(['name' => 'Andina Logistica']);

        $receipt = ReservationReceipt::build(Reservations::find($reservation->id));

        $this->assertSame('Saldo de Andina Logistica', $receipt['payment_method_label']);
    }

    public function test_a_card_payment_keeps_its_static_label_even_for_an_organization_reservation()
    {
        $organization = Organization::factory()->create();
        $reservation = $this->reservation(['organization_id' => $organization->id]);
        $this->payment($reservation, ['payment_method' => 'debit card']);

        $this->assertSame('Tarjeta de débito', ReservationReceipt::build($reservation)['payment_method_label']);
    }

    public function test_pdf_view_prints_the_wallet_label_and_the_org_identity()
    {
        $organization = Organization::factory()->create(['name' => 'Andina', 'ruc' => '1790011111001']);
        $reservation = $this->reservation(['organization_id' => $organization->id]);
        $this->payment($reservation, ['payment_method' => 'wallet']);

        $html = $this->renderPdfView(ReservationReceipt::build($reservation));

        $this->assertStringContainsString('Saldo de Andina', $html);
        $this->assertStringContainsString('(RUC 1790011111001)', $html);
        $this->assertStringNotContainsString('Tarjeta', $html);
    }

    public function test_pdf_view_shows_a_dash_for_a_missing_gestor_and_omits_a_missing_method()
    {
        $reservation = $this->reservation();
        $this->payment($reservation);
        $receipt = array_merge(ReservationReceipt::build($reservation), [
            'gestor_name' => null,
            'payment_method' => null,
            'payment_method_label' => null,
        ]);

        $html = $this->renderPdfView($receipt);

        $this->assertMatchesRegularExpression('/Gestor.*—/s', $html);
        $this->assertStringNotContainsString('Método de pago', $html);
        $this->assertStringContainsString('LEO-000123', $html);
    }

    public function test_pdf_view_escapes_user_supplied_text()
    {
        $reservation = $this->reservation([], ['title' => 'Bodega Peñón Ñandú <b>']);
        $this->payment($reservation);

        $html = $this->renderPdfView(ReservationReceipt::build($reservation));

        $this->assertStringContainsString('Bodega Peñón Ñandú &lt;b&gt;', $html);
        $this->assertStringNotContainsString('Ñandú <b>', $html);
        $this->assertStringContainsString('charset', $html);
    }
}
