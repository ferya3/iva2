'use server';

import { revalidatePath } from 'next/cache';
import { api, toFormError, type FormState } from '@/lib/api';

export async function changeVersionStatus(
  id: string,
  action: 'publish' | 'retire',
  _: FormState,
): Promise<FormState> {
  try {
    await api(`/admin/assessment-versions/${id}/${action}`, { method: 'POST' });
  } catch (e) {
    return toFormError(e);
  }
  revalidatePath('/assessments');
  return { ok: true };
}

const ageOrNull = (form: FormData, key: string) => {
  const v = String(form.get(key) ?? '').trim();
  return v === '' ? null : Number(v);
};

/** Who a version is for; new sessions pick the version whose range contains the patient's age. */
export async function updateEligibility(
  id: string,
  _: FormState,
  form: FormData,
): Promise<FormState> {
  try {
    await api(`/admin/assessment-versions/${id}`, {
      method: 'PATCH',
      body: {
        min_age_years: ageOrNull(form, 'min_age_years'),
        max_age_years: ageOrNull(form, 'max_age_years'),
        audience_label: String(form.get('audience_label') ?? '').trim() || null,
      },
    });
  } catch (e) {
    return toFormError(e);
  }
  revalidatePath('/assessments');
  return { ok: true, message: 'گروه سنی ذخیره شد.' };
}
