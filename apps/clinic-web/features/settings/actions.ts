'use server';

import { revalidatePath } from 'next/cache';
import { api, toFormError, type FormState } from '@/lib/api';

export async function updateClinic(_: FormState, form: FormData): Promise<FormState> {
  try {
    await api('/tenant', {
      method: 'PATCH',
      body: {
        name: form.get('name'),
        city: form.get('city') || null,
        phone: form.get('phone') || null,
        license_number: form.get('license_number') || null,
      },
    });
  } catch (e) {
    return toFormError(e);
  }
  revalidatePath('/', 'layout');
  return { ok: true, message: 'تنظیمات ذخیره شد.' };
}
