'use client';

import { useActionState } from 'react';
import { Alert, Field, Input, Select, Textarea } from '@cognitest/ui';
import { SubmitButton } from '@/components/submit-button';
import { uploadNormSet } from './actions';

/** Example rows: one line per metric, scope, sex and age band. */
const TEMPLATE = [
  'scope,metric_key,sex,age_min,age_max,mean,sd,n,direction',
  'overall,rt_mean,all,6,6,690,120,60,',
  'overall,rt_mean,all,7,7,640,110,60,',
  'overall,rt_mean,all,8,8,600,100,60,',
  'overall,hit_rate,all,6,8,0.86,0.08,180,',
  'overall,commission_rate,male,6,8,0.32,0.15,90,',
  'overall,commission_rate,female,6,8,0.27,0.13,90,',
  'visual,rt_mean,all,6,8,620,105,180,',
  'auditory,rt_mean,all,6,8,680,125,180,',
].join('\n');

export function NormUploadForm({ versions }: { versions: Array<{ id: string; label: string }> }) {
  const [state, action] = useActionState(uploadNormSet, { ok: true });
  const csvErrors = state.errors?.csv ?? [];
  return (
    <form action={action} className="space-y-4">
      {state.message ? (
        <Alert tone={state.ok ? 'success' : 'danger'}>
          {state.message}
          {csvErrors.length ? (
            <ul className="mt-2 list-disc space-y-1 ps-5">
              {csvErrors.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          ) : null}
        </Alert>
      ) : null}
      <Field label="نسخهٔ آزمون" htmlFor="assessment_version_id">
        <Select
          key={state.values?.assessment_version_id}
          id="assessment_version_id"
          name="assessment_version_id"
          defaultValue={state.values?.assessment_version_id ?? versions[0]?.id}
          required
        >
          {versions.map((v) => (
            <option key={v.id} value={v.id}>
              {v.label}
            </option>
          ))}
        </Select>
      </Field>
      <div className="grid grid-cols-3 gap-3">
        <Field label="نام هنجار" htmlFor="name" className="col-span-2" error={state.errors?.name}>
          <Input
            id="name"
            name="name"
            placeholder="هنجار کودکان تهران ۱۴۰۵"
            defaultValue={state.values?.name}
            required
          />
        </Field>
        <Field label="نسخه" htmlFor="version" error={state.errors?.version}>
          <Input
            id="version"
            name="version"
            dir="ltr"
            placeholder="1.0"
            defaultValue={state.values?.version}
            required
          />
        </Field>
      </div>
      <Field
        label="منبع / روش"
        htmlFor="source"
        hint="مثلاً «۴۸۰ دانش‌آموز ۶ تا ۸ سالهٔ تهران، نمونه‌گیری خوشه‌ای، ۱۴۰۵»"
      >
        <Textarea id="source" name="source" maxLength={2000} defaultValue={state.values?.source} />
      </Field>
      <label className="flex items-start gap-2 text-sm text-slate-700">
        <input
          type="checkbox"
          name="provisional"
          defaultChecked
          className="mt-1 h-4 w-4 rounded border-slate-300"
        />
        <span>
          هنجار مقدماتی است (نمونهٔ محدود/پایلوت)
          <span className="block text-xs text-slate-500">
            در گزارش‌ها با هشدار «تفسیر با احتیاط» نمایش داده می‌شود.
          </span>
        </span>
      </label>
      <Field
        label="فایل CSV"
        htmlFor="csv_file"
        error={state.errors?.csv_file}
        hint={
          <>
            هر سطر: میانگین و انحراف معیار یک شاخص برای یک گروه سنی (و جنس).{' '}
            <a
              href={`data:text/csv;charset=utf-8,${encodeURIComponent(TEMPLATE)}`}
              download="cognitest-norms-template.csv"
              className="font-medium text-brand-700 underline"
            >
              دریافت فایل نمونه
            </a>
          </>
        }
      >
        <Input id="csv_file" name="csv_file" type="file" accept=".csv,text/csv" required />
      </Field>
      <SubmitButton pendingText="در حال بررسی فایل…">بارگذاری به‌صورت پیش‌نویس</SubmitButton>
    </form>
  );
}
