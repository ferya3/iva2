'use server';

import { revalidatePath } from 'next/cache';
import { api, toFormError, type FormState } from '@/lib/api';

const intOrNull = (v: FormDataEntryValue | null) => (v === null || v === '' ? null : Number(v));

export async function updatePlan(id: number, _: FormState, form: FormData): Promise<FormState> {
  try {
    await api(`/admin/plans/${id}`, {
      method: 'PATCH',
      body: {
        name: form.get('name'),
        // Entered in Toman for convenience, stored in Rial.
        price_irr: Math.round(Number(form.get('price_toman') ?? 0) * 10),
        limits: {
          clinicians: intOrNull(form.get('clinicians')),
          sessions_per_month: intOrNull(form.get('sessions_per_month')),
        },
        is_active: form.get('is_active') === 'on',
      },
    });
  } catch (e) {
    return toFormError(e);
  }
  revalidatePath('/plans');
  return { ok: true, message: 'ذخیره شد.' };
}
