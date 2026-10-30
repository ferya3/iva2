<?php

namespace App\Http\Middleware;

use App\Exceptions\ApiException;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

final class LimitRequestSize
{
    public function handle(Request $request, Closure $next, int $kilobytes = 1024): Response
    {
        $length = (int) $request->header('Content-Length', strlen($request->getContent()));
        if ($length > $kilobytes * 1024) {
            throw new ApiException("Request body exceeds {$kilobytes} KB.", 'payload_too_large', 413);
        }

        return $next($request);
    }
}
