'use client';

import Link from 'next/link';
import { useActionState, useState } from 'react';
import { Alert, Field, Select, Textarea, faNumber } from '@cognitest/ui';
import { SubmitButton } from '@/components/submit-button';
import type { AssessmentType, AssessmentVersionSummary, Patient } from '@/lib/types';
import { createSession } from './actions';

const minutes = (v: AssessmentVersionSummary) =>
  faNumber(Math.max(1, Math.round(v.estimated_duration_seconds / 60)));

function coversAge(v: AssessmentVersionSummary, age: number | null): boolean {
  if (age === null) return v.min_age_years === null && v.max_age_years === null;
  return (
    (v.min_age_years === null || age >= v.min_age_years) &&
    (v.max_age_years === null || age <= v.max_age_years)
  );
}

/** Same rule as the API: the newest published version whose age range contains the age. */
function versionForAge(type: AssessmentType | undefined, age: number | null) {
  return type?.versions
    .filter((v) => coversAge(v, age))
    .sort((a, b) => (b.published_at ?? '').localeCompare(a.published_at ?? ''))[0];
}

/** "کودکان ۶ تا ۸ سال" or "نوجوانان و بزرگسالان (۹ سال به بالا)": the range only when the label lacks it. */
const versionLabel = (v: AssessmentVersionSummary) => {
  const label = v.audience_label ?? `نسخه ${v.version}`;
  return v.age_range_label && !/[0-9۰-۹]/.test(label) ? `${label} (${v.age_range_label})` : label;
};

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
  const [selectedPatient, setSelectedPatient] = useState(patientId ?? '');
  const [selectedType, setSelectedType] = useState(types.length === 1 ? types[0]!.id : '');
  const [manualVersion, setManualVersion] = useState('');

  const patient = patients.find((p) => p.id === selectedPatient);
  const type = types.find((t) => t.id === selectedType);
  const age = patient?.age_years ?? null;
  const auto = versionForAge(type, age);
  const manual = type?.versions.find((v) => v.id === manualVersion);

  return (
    <form action={action} className="space-y-5">
      {!state.ok && state.message ? <Alert tone="danger">{state.message}</Alert> : null}
      <Field label="مراجعه‌کننده" htmlFor="patient_id" error={state.errors?.patient_id}>
        <Select
          id="patient_id"
          name="patient_id"
          value={selectedPatient}
          onChange={(e) => setSelectedPatient(e.target.value)}
          required
        >
          <option value="" disabled>
            انتخاب کنید…
          </option>
          {patients.map((p) => (
            <option key={p.id} value={p.id}>
              {p.patient_code} —{' '}
              {[p.first_name, p.last_name].filter(Boolean).join(' ') || 'بدون نام'}
              {p.age_years !== null ? ` · ${faNumber(p.age_years)} ساله` : ''}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="آزمون" htmlFor="assessment_type_id" error={state.errors?.assessment_type_id}>
        <Select
          id="assessment_type_id"
          name="assessment_type_id"
          value={selectedType}
          onChange={(e) => {
            setSelectedType(e.target.value);
            setManualVersion('');
          }}
          required
        >
          <option value="" disabled>
            انتخاب کنید…
          </option>
          {types.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </Select>
      </Field>

      {patient && type && !manual ? (
        auto ? (
          <Alert tone="info" title="نسخهٔ متناسب با سن">
            {versionLabel(auto)} · حدود {minutes(auto)} دقیقه
            {auto.is_clinical ? '' : ' · غیربالینی'}
            {age !== null ? ` — بر اساس سن ${faNumber(age)} سال` : ''}
          </Alert>
        ) : age === null ? (
          <Alert tone="warning" title="تاریخ تولد ثبت نشده است">
            نسخهٔ آزمون بر اساس سن انتخاب می‌شود.{' '}
            <Link href={`/patients/${patient.id}`} className="font-semibold underline">
              تاریخ تولد را در پروندهٔ مراجع وارد کنید
            </Link>{' '}
            یا نسخه را دستی انتخاب کنید.
          </Alert>
        ) : (
          <Alert tone="warning" title="نسخه‌ای برای این سن تعریف نشده است">
            نسخه‌های موجود: {type.versions.map((v) => v.age_range_label ?? v.version).join('، ')}.
            در صورت نیاز، نسخه را دستی انتخاب کنید.
          </Alert>
        )
      ) : null}

      {type && type.versions.length > 1 ? (
        <details className="rounded-lg border border-slate-200 p-3 text-sm" open={!!manualVersion}>
          <summary className="cursor-pointer text-slate-600">انتخاب دستی نسخه (پیشرفته)</summary>
          <div className="mt-3 space-y-2">
            <Select
              aria-label="نسخهٔ آزمون"
              value={manualVersion}
              onChange={(e) => setManualVersion(e.target.value)}
            >
              <option value="">خودکار بر اساس سن (پیشنهادی)</option>
              {type.versions.map((v) => (
                <option key={v.id} value={v.id}>
                  {versionLabel(v)} — {minutes(v)} دقیقه
                </option>
              ))}
            </Select>
            {manual && !coversAge(manual, age) ? (
              <p className="text-xs text-amber-700">
                این نسخه برای سن این مراجع طراحی نشده است؛ انتخاب دستی در سوابق ثبت می‌شود و نتایج
                با هنجار هم‌سالان قابل مقایسه نخواهد بود.
              </p>
            ) : null}
          </div>
        </details>
      ) : null}
      {manual ? (
        <>
          <input type="hidden" name="assessment_version_id" value={manual.id} />
          {!coversAge(manual, age) ? (
            <input type="hidden" name="allow_age_override" value="1" />
          ) : null}
        </>
      ) : null}

      <Field label="یادداشت (اختیاری)" htmlFor="notes">
        <Textarea id="notes" name="notes" maxLength={2000} />
      </Field>
      <div className="flex justify-end">
        <SubmitButton pendingText="در حال ایجاد…">ایجاد جلسه و صدور کد ورود</SubmitButton>
      </div>
    </form>
  );
}
