'use client';

import { useActionState } from 'react';
import { Alert, Field, Input } from '@cognitest/ui';
import { SubmitButton } from '@/components/submit-button';
import { updatePlan } from './actions';

export interface Plan {
  id: number;
  key: string;
  name: string;
  price_irr: number;
  limits: { clinicians?: number | null; sessions_per_month?: number | null };
  is_active: boolean;
}

export function PlanForm({ plan }: { plan: Plan }) {
  const [state, action] = useActionState(updatePlan.bind(null, plan.id), { ok: true });
  return (
    <form action={action} className="space-y-3">
      {state.message ? <Alert tone={state.ok ? 'success' : 'danger'}>{state.message}</Alert> : null}
      <Field label="نام" htmlFor={`name-${plan.id}`}>
        <Input id={`name-${plan.id}`} name="name" defaultValue={plan.name} />
      </Field>
      <Field
        label="قیمت ماهانه (تومان)"
        htmlFor={`price-${plan.id}`}
        hint="در پایگاه داده به ریال ذخیره می‌شود."
      >
        <Input
          id={`price-${plan.id}`}
          name="price_toman"
          type="number"
          min={0}
          dir="ltr"
          defaultValue={plan.price_irr / 10}
        />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="تعداد متخصص" htmlFor={`cl-${plan.id}`} hint="خالی = نامحدود">
          <Input
            id={`cl-${plan.id}`}
            name="clinicians"
            type="number"
            min={1}
            dir="ltr"
            defaultValue={plan.limits.clinicians ?? ''}
          />
        </Field>
        <Field label="جلسه در ماه" htmlFor={`sp-${plan.id}`} hint="خالی = نامحدود">
          <Input
            id={`sp-${plan.id}`}
            name="sessions_per_month"
            type="number"
            min={1}
            dir="ltr"
            defaultValue={plan.limits.sessions_per_month ?? ''}
          />
        </Field>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="is_active" defaultChecked={plan.is_active} /> فعال
      </label>
      <SubmitButton size="sm" pendingText="…">
        ذخیره
      </SubmitButton>
    </form>
  );
}
