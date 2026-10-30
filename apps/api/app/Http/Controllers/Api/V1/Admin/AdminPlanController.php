<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Controller;
use App\Models\Plan;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AdminPlanController extends Controller
{
    public function index(): JsonResponse
    {
        return response()->json(['data' => Plan::query()->orderBy('price_irr')->get()]);
    }

    public function store(Request $request): JsonResponse
    {
        return response()->json(['data' => Plan::create($this->validated($request))], 201);
    }

    public function update(Request $request, Plan $plan): JsonResponse
    {
        $plan->update($this->validated($request, $plan));

        return response()->json(['data' => $plan]);
    }

    private function validated(Request $request, ?Plan $plan = null): array
    {
        return $request->validate([
            'key' => [$plan ? 'sometimes' : 'required', 'string', 'max:32', 'regex:/^[a-z0-9_]+$/', 'unique:plans,key'.($plan ? ','.$plan->id : '')],
            'name' => [$plan ? 'sometimes' : 'required', 'string', 'max:64'],
            'price_irr' => [$plan ? 'sometimes' : 'required', 'integer', 'min:0'],
            'billing_period' => ['sometimes', 'in:monthly,yearly'],
            'limits' => ['sometimes', 'array'],
            'limits.clinicians' => ['nullable', 'integer', 'min:1'],
            'limits.sessions_per_month' => ['nullable', 'integer', 'min:1'],
            'is_active' => ['sometimes', 'boolean'],
        ]);
    }
}
