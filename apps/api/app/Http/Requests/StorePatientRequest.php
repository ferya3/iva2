<?php

namespace App\Http\Requests;

use App\Domain\Tenancy\TenantContext;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StorePatientRequest extends FormRequest
{
    public function rules(): array
    {
        $tenantId = app(TenantContext::class)->id();
        $patient = $this->route('patient');

        return [
            'patient_code' => [
                $patient ? 'sometimes' : 'nullable', 'string', 'max:32', 'regex:/^[A-Za-z0-9\-_]+$/',
                Rule::unique('patients', 'patient_code')->where('tenant_id', $tenantId)->ignore($patient?->id),
            ],
            'first_name' => ['nullable', 'string', 'max:100'],
            'last_name' => ['nullable', 'string', 'max:100'],
            'national_id' => ['nullable', 'string', 'regex:/^\d{10}$/'],
            'birth_date' => ['nullable', 'date', 'before:today', 'after:1900-01-01'],
            'sex' => ['nullable', Rule::in(['female', 'male', 'other'])],
            'handedness' => ['nullable', Rule::in(['right', 'left', 'ambidextrous'])],
            'education' => ['nullable', 'string', 'max:32'],
            'phone' => ['nullable', 'string', 'regex:/^(\+98|0)?9\d{9}$/'],
            'guardian' => ['nullable', 'array'],
            'guardian.full_name' => ['required_with:guardian', 'string', 'max:200'],
            'guardian.relation' => ['required_with:guardian', Rule::in(['mother', 'father', 'legal_guardian', 'other'])],
            'guardian.phone' => ['nullable', 'string', 'max:20'],
            'consent' => ['nullable', 'array'],
            'consent.accepted_by_name' => ['required_with:consent', 'string', 'max:200'],
            'consent.version' => ['required_with:consent', 'string', 'max:16'],
            'research_consent' => ['sometimes', 'boolean'],
        ];
    }

    public function messages(): array
    {
        return [
            'national_id.regex' => 'کد ملی باید ۱۰ رقم باشد.',
            'phone.regex' => 'شماره موبایل معتبر نیست.',
        ];
    }

    /** Accept Persian/Arabic digits from Persian keyboards. */
    protected function prepareForValidation(): void
    {
        $map = ['۰' => '0', '۱' => '1', '۲' => '2', '۳' => '3', '۴' => '4', '۵' => '5', '۶' => '6', '۷' => '7', '۸' => '8', '۹' => '9',
            '٠' => '0', '١' => '1', '٢' => '2', '٣' => '3', '٤' => '4', '٥' => '5', '٦' => '6', '٧' => '7', '٨' => '8', '٩' => '9'];
        foreach (['national_id', 'phone', 'patient_code'] as $field) {
            if (is_string($this->input($field))) {
                $this->merge([$field => strtr($this->input($field), $map)]);
            }
        }
    }
}
