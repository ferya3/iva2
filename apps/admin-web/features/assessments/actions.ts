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
