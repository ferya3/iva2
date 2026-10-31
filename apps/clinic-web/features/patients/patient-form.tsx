'use client';

import { useActionState } from 'react';
import { Alert, Field, Input, Select } from '@cognitest/ui';
import type { FormState } from '@/lib/api';
import type { Patient } from '@/lib/types';
import { SubmitButton } from '@/components/submit-button';

type Action = (state: FormState, form: FormData) => Promise<FormState>;

export function PatientForm({ action, patient }: { action: Action; patient?: Patient }) {
  const [state, formAction] = useActionState(action, { ok: true });
  const err = (k: string) => state.errors?.[k];
  const isNew = !patient;

  return (
    <form action={formAction} className="space-y-6">
      {state.message ? <Alert tone={state.ok ? 'success' : 'danger'}>{state.message}</Alert> : null}

      <fieldset className="grid gap-4 sm:grid-cols-2">
        <legend className="mb-3 text-sm font-semibold text-slate-800">اطلاعات هویتی</legend>
        <Field label="نام" htmlFor="first_name" error={err('first_name')}>
          <Input id="first_name" name="first_name" defaultValue={patient?.first_name ?? ''} />
        </Field>
        <Field label="نام خانوادگی" htmlFor="last_name" error={err('last_name')}>
          <Input id="last_name" name="last_name" defaultValue={patient?.last_name ?? ''} />
        </Field>
        <Field
          label="کد ملی"
          htmlFor="national_id"
          error={err('national_id')}
          hint="به‌صورت رمزنگاری‌شده ذخیره می‌شود."
        >
          <Input
            id="national_id"
            name="national_id"
            inputMode="numeric"
            dir="ltr"
            maxLength={10}
            defaultValue={patient?.national_id ?? ''}
          />
        </Field>
        <Field
          label="تاریخ تولد (میلادی)"
          htmlFor="birth_date"
          error={err('birth_date')}
          hint="برای انتخاب نسخهٔ آزمون متناسب با سن و مقایسه با هم‌سالان لازم است."
        >
          <Input
            id="birth_date"
            name="birth_date"
            type="date"
            dir="ltr"
            defaultValue={patient?.birth_date ?? ''}
          />
        </Field>
        <Field label="جنسیت" htmlFor="sex" error={err('sex')}>
          <Select id="sex" name="sex" defaultValue={patient?.sex ?? ''}>
            <option value="">—</option>
            <option value="female">زن</option>
            <option value="male">مرد</option>
            <option value="other">سایر</option>
          </Select>
        </Field>
        <Field label="دست غالب" htmlFor="handedness" error={err('handedness')}>
          <Select id="handedness" name="handedness" defaultValue={patient?.handedness ?? ''}>
            <option value="">—</option>
            <option value="right">راست</option>
            <option value="left">چپ</option>
            <option value="ambidextrous">هر دو</option>
          </Select>
        </Field>
        <Field label="تحصیلات" htmlFor="education" error={err('education')}>
          <Select id="education" name="education" defaultValue={patient?.education ?? ''}>
            <option value="">—</option>
            <option value="preschool">پیش‌دبستانی</option>
            <option value="primary">دبستان</option>
            <option value="secondary">متوسطه</option>
            <option value="diploma">دیپلم</option>
            <option value="bachelor">کارشناسی</option>
            <option value="graduate">تحصیلات تکمیلی</option>
          </Select>
        </Field>
        <Field label="موبایل" htmlFor="phone" error={err('phone')}>
          <Input
            id="phone"
            name="phone"
            inputMode="tel"
            dir="ltr"
            placeholder="09xxxxxxxxx"
            defaultValue={patient?.phone ?? ''}
          />
        </Field>
        <Field
          label="کد پرونده"
          htmlFor="patient_code"
          error={err('patient_code')}
          hint={isNew ? 'خالی بگذارید تا خودکار ساخته شود.' : undefined}
        >
          <Input
            id="patient_code"
            name="patient_code"
            dir="ltr"
            defaultValue={patient?.patient_code ?? ''}
          />
        </Field>
      </fieldset>

      {isNew ? (
        <fieldset className="grid gap-4 border-t border-slate-100 pt-6 sm:grid-cols-3">
          <legend className="mb-3 text-sm font-semibold text-slate-800">
            ولی / همراه (برای کودکان)
          </legend>
          <Field
            label="نام و نام خانوادگی"
            htmlFor="guardian_name"
            error={err('guardian.full_name')}
          >
            <Input id="guardian_name" name="guardian_name" />
          </Field>
          <Field label="نسبت" htmlFor="guardian_relation">
            <Select id="guardian_relation" name="guardian_relation" defaultValue="mother">
              <option value="mother">مادر</option>
              <option value="father">پدر</option>
              <option value="legal_guardian">قیم قانونی</option>
              <option value="other">سایر</option>
            </Select>
          </Field>
          <Field label="تلفن" htmlFor="guardian_phone">
            <Input id="guardian_phone" name="guardian_phone" dir="ltr" />
          </Field>
          <Field
            label="رضایت آگاهانه ثبت شد توسط"
            htmlFor="consent_by"
            className="sm:col-span-3"
            hint="نام فردی که فرم رضایت را امضا کرده است."
          >
            <Input id="consent_by" name="consent_by" />
          </Field>
        </fieldset>
      ) : null}

      <fieldset className="border-t border-slate-100 pt-6">
        <legend className="mb-3 text-sm font-semibold text-slate-800">استفادهٔ پژوهشی</legend>
        <label className="flex items-start gap-3 text-sm text-slate-700">
          <input
            type="checkbox"
            name="research_consent"
            defaultChecked={patient?.research_consent ?? false}
            className="mt-1 h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
          />
          <span>
            مراجع (یا ولی او) رضایت داده است که نتایج آزمون‌هایش، <b>بدون نام و اطلاعات هویتی</b>،
            برای ساختن هنجارهای سنی (مقایسه با هم‌سالان) استفاده شود.
            <span className="mt-1 block text-xs text-slate-500">
              فقط سن، جنس، دست برتر، تحصیلات و نتایج آزمون استفاده می‌شود. این رضایت هر زمان با
              برداشتن تیک لغو می‌شود.
            </span>
          </span>
        </label>
      </fieldset>

      <div className="flex justify-end">
        <SubmitButton pendingText="در حال ذخیره…">
          {isNew ? 'ثبت مراجعه‌کننده' : 'ذخیره تغییرات'}
        </SubmitButton>
      </div>
    </form>
  );
}
