<?php

use App\Http\Middleware\ApiAuthenticate;
use App\Http\Middleware\EnsureUserHasRole;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        //
        // $middleware->appendToGroup('api', \Laravel\Sanctum\Http\Middleware\EnsureFrontendRequestsAreStateful::class);
        $middleware->alias([
            'auth.api' => ApiAuthenticate::class,
            'role' => EnsureUserHasRole::class,
        ]);
        $middleware->append(\Illuminate\Http\Middleware\HandleCors::class);
        $middleware->trustHosts([ // se cambia a hosting cuando haya dominio real
            '127\.0\.0\.1',
            'localhost',
            'leodegafront\.vercel\.app',
            'leodega-soft-ll-production-a8de\.up\.railway\.app',
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        //
    })->create();
