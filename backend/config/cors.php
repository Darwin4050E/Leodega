<?php

return [
    'paths' => ['api/*', 'sanctum/csrf-cookie'],

    'allowed_methods' => ['*'],

    'allowed_origins' => [
        'http://localhost:5173',
        'http://localhost:5174',
        'http://localhost:5175',
        'http://localhost:3000',
        // Vite prints BOTH localhost and 127.0.0.1 on startup, and the browser
        // treats them as distinct origins. Without these mirrors, opening the
        // app on 127.0.0.1 blocks every API call, and each screen falls back to
        // its own generic message ("Error al iniciar sesión", "Error al crear la
        // cuenta") — which points the reader at the wrong layer entirely.
        'http://127.0.0.1:5173',
        'http://127.0.0.1:5174',
        'http://127.0.0.1:5175',
        'http://127.0.0.1:3000',
        'https://leodegafront.vercel.app',
    ],

    'allowed_origins_patterns' => [],

    'allowed_headers' => ['*'],

    'exposed_headers' => [],

    'max_age' => 0,

    'supports_credentials' => true,
];
