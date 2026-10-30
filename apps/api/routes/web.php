<?php

use Illuminate\Support\Facades\Route;

// The API has no web UI; panels are separate Next.js apps.
Route::get('/', fn () => response()->json([
    'name' => 'Cognitest API',
    'version' => 'v1',
    'docs' => '/docs/api/openapi.yaml',
]));
