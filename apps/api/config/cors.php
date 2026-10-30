<?php

/*
 * The panels call the API server-side (BFF) and the desktop player from the
 * Electron main process, so browsers never need cross-origin access. Only
 * the panel origins are allowed, as a safety net for future client calls.
 */
return [
    'paths' => ['api/*'],
    'allowed_methods' => ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    'allowed_origins' => array_values(array_filter([
        env('CLINIC_WEB_URL'),
        env('ADMIN_WEB_URL'),
    ])),
    'allowed_origins_patterns' => [],
    'allowed_headers' => ['Accept', 'Authorization', 'Content-Type', 'X-Tenant-ID', 'Accept-Language'],
    'exposed_headers' => [],
    'max_age' => 3600,
    'supports_credentials' => false,
];
