<?php

namespace App\Providers;

use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    public const INVITATIONS_THROTTLED_MESSAGE = 'Enviaste demasiadas invitaciones. Intenta de nuevo en un minuto.';

    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        // hue-01 INV-8: per inviter, shared across organizations, and every
        // attempt counts (refusals included) so probing emails is bounded. The
        // response callback replaces Laravel's default "Too Many Attempts." body.
        RateLimiter::for('org-invitations', fn (Request $request) => Limit::perMinute(10)
            ->by('org-invitations:'.($request->user()?->id ?? $request->ip()))
            ->response(fn (Request $request, array $headers) => response()->json(
                ['message' => self::INVITATIONS_THROTTLED_MESSAGE],
                429,
                $headers
            )));
    }
}
