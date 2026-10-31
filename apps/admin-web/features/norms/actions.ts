'use server';

import { revalidatePath } from 'next/cache';
import { api, formValues, toFormError, type FormState } from '@/lib/api';

export async function uploadNormSet(_: FormState, form: FormData): Promise<FormState> {
  const file = form.get('csv_file');
  const csv = file instanceof File && file.size > 0 ? await file.text() : '';
  if (!csv) {
    return {
      ok: false,
      errors: { csv_file: ['فایل CSV را انتخاب کنید.'] },
      values: formValues(form),
    };
  }
  try {
    await api(`/admin/assessment-versions/${String(form.get('assessment_version_id'))}/norm-sets`, {
      method: 'POST',
      body: {
        name: form.get('name'),
        version: form.get('version'),
        provisional: form.get('provisional') === 'on',
        source: form.get('source') || null,
        csv,
      },
    });
  } catch (e) {
    return { ...toFormError(e), values: formValues(form) };
  }
  revalidatePath('/norms');
  return {
    ok: true,
    message: 'هنجار به‌صورت پیش‌نویس ثبت شد. پس از بازبینی، آن را منتشر کنید.',
  };
}

export async function changeNormSet(
  id: string,
  action: 'publish' | 'retire' | 'delete',
  _: FormState,
): Promise<FormState> {
  try {
    await api(action === 'delete' ? `/admin/norm-sets/${id}` : `/admin/norm-sets/${id}/${action}`, {
      method: action === 'delete' ? 'DELETE' : 'POST',
    });
  } catch (e) {
    return toFormError(e);
  }
  revalidatePath('/norms');
  return { ok: true };
}
