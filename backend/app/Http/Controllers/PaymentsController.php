<?php

namespace App\Http\Controllers;

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
     * el estilo de validación manual (Validator manual) del resto del CRUD
     * genérico heredado, para conservar el mensaje "Validation Error".
     */
    public function store(Request $request, PaymentService $paymentService)
    {
        $validator = Validator::make($request->all(), (new StorePaymentRequest)->rules());
        if ($validator->fails()) {
            return response()->json([
                'message' => 'Validation Error',
                'errors' => $validator->errors(),
            ], 422);
        }

        $validated = $validator->validated();

        $reservation = Reservations::find($validated['reservation_id']);
        if (! $reservation) {
            return response()->json(['message' => 'Reservation not found'], 404);
        }

        Gate::authorize('create', [Payments::class, $reservation]);

        $result = $paymentService->process($reservation, $validated, auth()->id());

        return response()->json([
            'item' => $result['payment'],
            'message' => 'Item created successfully',
            'status' => $result['status'],
        ], $result['status']);
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
