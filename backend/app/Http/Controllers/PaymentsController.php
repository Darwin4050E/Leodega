<?php

namespace App\Http\Controllers;

use App\Exceptions\ReservationConflictException;
use App\Http\Requests\StorePaymentRequest;
use App\Http\Requests\UpdatePaymentRequest;
use App\Models\Payments;
use App\Models\Reservations;
use App\Services\PaymentService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Validator;

class PaymentsController extends ApiController
{
    public function index()
    {
        return $this->indexModel(Payments::class);
    }

    public function show($id)
    {
        return $this->showModel(Payments::class, $id);
    }

    /**
     * Corrección de inconsistencia (ver PLAN_CORRECCION_INCONSISTENCIAS.md,
     * Fase 2.2): antes usaba el CRUD genérico (storeModel), sin autorización
     * de ownership ni vínculo con ReservationService::confirm(). Se mantiene
     * el estilo de validación 400 (Validator manual) del resto del CRUD
     * genérico heredado, en vez del 422 por defecto de $request->validate().
     */
    public function store(Request $request, PaymentService $paymentService)
    {
        $validator = Validator::make($request->all(), (new StorePaymentRequest)->rules());
        if ($validator->fails()) {
            return response()->json([
                'message' => 'Validation Error',
                'errors' => $validator->errors(),
                'status' => 400,
            ], 400);
        }

        $validated = $validator->validated();

        $reservation = Reservations::find($validated['reservation_id']);
        if (! $reservation) {
            return response()->json(['message' => 'Reservation not found', 'status' => 404], 404);
        }

        Gate::authorize('create', [Payments::class, $reservation]);

        try {
            $payment = $paymentService->process($reservation, $validated, auth()->id());
        } catch (ReservationConflictException $e) {
            return response()->json(['message' => $e->getMessage()], 409);
        }

        return response()->json([
            'item' => $payment,
            'message' => 'Item created successfully',
            'status' => 201,
        ], 201);
    }

    public function update(Request $request, $id)
    {
        return $this->updateModel($request, Payments::class, $id, (new UpdatePaymentRequest)->rules());
    }

    public function destroy($id)
    {
        return $this->destroyModel(Payments::class, $id);
    }
}
