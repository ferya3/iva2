'use client';

import { useActionState } from 'react';
import { Alert, Field, Select, Textarea, faNumber } from '@cognitest/ui';
import { SubmitButton } from '@/components/submit-button';
import type { AssessmentType, Patient } from '@/lib/types';
import { createSession } from './actions';

export function SessionForm({
  patients,
  types,
  patientId,
}: {
  patients: Patient[];
  types: AssessmentType[];
  patientId?: string;
}) {
  const [state, action] = useActionState(createSession, { ok: true });
  return (
    <form action={action} className="space-y-5">
      {!state.ok && state.message ? <Alert tone="danger">{state.message}</Alert> : null}
      <Field label="مراجعه‌کننده" htmlFor="patient_id" error={state.errors?.patient_id}>
        <Select id="patient_id" name="patient_id" defaultValue={patientId ?? ''} required>
          <option value="" disabled>
            انتخاب کنید…
          </option>
          {patients.map((p) => (
            <option key={p.id} value={p.id}>
              {p.patient_code} —{' '}
              {[p.first_name, p.last_name].filter(Boolean).join(' ') || 'بدون نام'}
            </option>
          ))}
        </Select>
      </Field>
      <Field
        label="آزمون"
        htmlFor="assessment_version_id"
        error={state.errors?.assessment_version_id}
      >
        <Select id="assessment_version_id" name="assessment_version_id" required defaultValue="">
          <option value="" disabled>
            انتخاب کنید…
          </option>
          {types.flatMap((t) =>
            t.versions.map((v) => (
              <option key={v.id} value={v.id}>
                {t.name} — نسخه {v.version} (
                {faNumber(Math.round(v.estimated_duration_seconds / 60))} دقیقه)
                {v.is_clinical ? '' : ' · غیربالینی'}
              </option>
            )),
          )}
        </Select>
      </Field>
      <Field label="یادداشت (اختیاری)" htmlFor="notes">
        <Textarea id="notes" name="notes" maxLength={2000} />
      </Field>
      <div className="flex justify-end">
        <SubmitButton pendingText="در حال ایجاد…">ایجاد جلسه و صدور کد ورود</SubmitButton>
      </div>
    </form>
  );
}
