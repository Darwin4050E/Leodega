<?php

namespace App\Http\Requests\Concerns;

use App\Services\OrganizationReservationEventService;
use Illuminate\Http\Exceptions\HttpResponseException;
use Illuminate\Support\Facades\Log;

/**
 * HUE-06 OR-13/OR-15: authorization of the tenant cancel and preview routes
 * runs in the FormRequest, so it precedes validation and a denied caller never
 * sees a 422. Every denial returns the same 403 body whatever the caller class,
 * so the existence of an organization is never revealed.
 */
trait AuthorizesTenantReservationCancellation
{
    public const DENIED_MESSAGE = 'No autorizado';

    /**
     * The operation recorded when an organization member is denied.
     */
    abstract protected function attemptedAction(): string;

    public function authorize(): bool
    {
        return $this->user()->can('cancelAsTenant', $this->route('reservation'));
    }

    protected function failedAuthorization(): never
    {
        $this->auditDeniedAttempt();

        throw new HttpResponseException(response()->json(['message' => self::DENIED_MESSAGE], 403));
    }

    // OR-23: no transaction is open here, so the row survives the 403; a failed
    // write is logged and never turns the denial into a 5xx.
    private function auditDeniedAttempt(): void
    {
        try {
            app(OrganizationReservationEventService::class)
                ->recordDeniedAttempt($this->route('reservation'), $this->user(), $this->attemptedAction());
        } catch (\Throwable $e) {
            Log::error('Failed to record organization reservation denied attempt', [
                'reservation_id' => $this->route('reservation')->id,
                'user_id' => $this->user()->id,
                'error' => $e->getMessage(),
            ]);
        }
    }
}
