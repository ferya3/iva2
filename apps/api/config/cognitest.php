<?php

return [
    'clinic_web_url' => env('CLINIC_WEB_URL', 'http://localhost:3000'),
    'admin_web_url' => env('ADMIN_WEB_URL', 'http://localhost:3001'),
    'deep_link_scheme' => env('PLAYER_DEEP_LINK_SCHEME', 'cognitest'),

    'invites' => [
        'ttl_hours' => (int) env('INVITE_TTL_HOURS', 72),
        'player_token_ttl_hours' => (int) env('PLAYER_TOKEN_TTL_HOURS', 12),
    ],

    'events' => [
        // Must equal EVENT_BATCH_LIMITS in packages/validation.
        'max_batch_events' => 500,
        'max_timestamp_ms' => 4 * 60 * 60 * 1000,
        'max_string_length' => 128,
        'max_request_kb' => 1024,
    ],

    'scoring' => [
        'node_binary' => env('SCORING_NODE_BINARY', 'node'),
        'cli_path' => env('SCORING_CLI_PATH', base_path('../../packages/scoring-engine/dist/cli.mjs')),
        'timeout' => (int) env('SCORING_TIMEOUT', 120),
    ],

    'reports' => [
        'disk' => env('REPORTS_DISK', 'reports'),
        'chromium_binary' => env('PDF_CHROMIUM_BINARY', 'chromium-headless-shell'),
        'timeout' => (int) env('PDF_TIMEOUT', 60),
    ],
];
