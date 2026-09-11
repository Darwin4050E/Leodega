<?php

namespace Tests\Unit;

use App\Exceptions\AccountBlockedException;
use App\Exceptions\AccountModerationException;
use App\Exceptions\DuplicateRatingException;
use App\Exceptions\ReservationConflictException;
use App\Exceptions\ReservationPricingException;
use App\Exceptions\StoreRoomResubmissionException;
use Illuminate\Http\Request;
use Tests\TestCase;

class ExceptionRenderTest extends TestCase
{
    private function jsonRequest(): Request
    {
        $request = Request::create('/api/test', 'GET');
        $request->headers->set('Accept', 'application/json');

        return $request;
    }

    public function test_account_blocked_exception_renders_403_with_message_and_no_status_key(): void
    {
        $exception = new AccountBlockedException('Tu cuenta está bloqueada');

        $response = $exception->render($this->jsonRequest());

        $this->assertSame(403, $response->getStatusCode());
        $data = $response->getData(true);
        $this->assertSame(['message' => 'Tu cuenta está bloqueada'], $data);
        $this->assertArrayNotHasKey('status', $data);
    }

    public function test_account_moderation_exception_renders_at_its_own_status_code(): void
    {
        $exception = AccountModerationException::denied('No puedes moderar tu propia cuenta');

        $response = $exception->render($this->jsonRequest());

        $this->assertSame(403, $response->getStatusCode());
        $data = $response->getData(true);
        $this->assertSame(['message' => 'No puedes moderar tu propia cuenta'], $data);
        $this->assertArrayNotHasKey('status', $data);
    }

    public function test_account_moderation_exception_conflict_renders_409(): void
    {
        $exception = AccountModerationException::conflict('La cuenta ya está bloqueada');

        $response = $exception->render($this->jsonRequest());

        $this->assertSame(409, $response->getStatusCode());
        $this->assertArrayNotHasKey('status', $response->getData(true));
    }

    public function test_reservation_conflict_exception_renders_409(): void
    {
        $exception = new ReservationConflictException('La bodega ya está reservada en esas fechas.');

        $response = $exception->render($this->jsonRequest());

        $this->assertSame(409, $response->getStatusCode());
        $data = $response->getData(true);
        $this->assertSame(['message' => 'La bodega ya está reservada en esas fechas.'], $data);
        $this->assertArrayNotHasKey('status', $data);
    }

    public function test_reservation_pricing_exception_renders_422(): void
    {
        $exception = new ReservationPricingException('No hay un precio elegible para esta bodega.');

        $response = $exception->render($this->jsonRequest());

        $this->assertSame(422, $response->getStatusCode());
        $data = $response->getData(true);
        $this->assertSame(['message' => 'No hay un precio elegible para esta bodega.'], $data);
        $this->assertArrayNotHasKey('status', $data);
    }

    public function test_store_room_resubmission_exception_renders_at_its_own_status_code(): void
    {
        $exception = StoreRoomResubmissionException::conflict('La bodega no está rechazada; no hay nada que reenviar.');

        $response = $exception->render($this->jsonRequest());

        $this->assertSame(409, $response->getStatusCode());
        $data = $response->getData(true);
        $this->assertSame(['message' => 'La bodega no está rechazada; no hay nada que reenviar.'], $data);
        $this->assertArrayNotHasKey('status', $data);
    }

    public function test_duplicate_rating_exception_renders_409_with_message_from_throw_site(): void
    {
        $exception = new DuplicateRatingException('Ya calificaste esta bodega');

        $response = $exception->render($this->jsonRequest());

        $this->assertSame(409, $response->getStatusCode());
        $data = $response->getData(true);
        $this->assertSame(['message' => 'Ya calificaste esta bodega'], $data);
        $this->assertArrayNotHasKey('status', $data);
    }
}
