'use server';

import { revalidatePath } from 'next/cache';
import {
  api,
  formValues,
  toCredentials,
  toFormError,
  type ApiCredentials,
  type FormState,
} from '@/lib/api';

export async function createTenant(_: FormState, form: FormData): Promise<FormState> {
  let credentials: ApiCredentials | null = null;
  try {
    const res = await api<{ credentials: ApiCredentials | null }>('/admin/tenants', {
      method: 'POST',
      body: {
        name: form.get('name'),
        city: form.get('city') || null,
        owner_name: form.get('owner_name'),
        owner_email: form.get('owner_email'),
        plan: form.get('plan'),
      },
    });
    credentials = res.credentials;
  } catch (e) {
    return { ...toFormError(e), values: formValues(form) };
  }
  revalidatePath('/tenants');
  return credentials
    ? { ok: true, message: 'کلینیک ایجاد شد.', credentials: toCredentials(credentials) }
    : {
        ok: true,
        message: `کلینیک ایجاد شد. ${String(form.get('owner_email'))} از قبل حساب داشت و با همان رمز قبلی خود وارد می‌شود.`,
      };
}

/** New temporary password for the clinic owner (e.g. the first one was lost). */
export async function resetOwnerPassword(id: string, _: FormState): Promise<FormState> {
  try {
    const res = await api<{ credentials: ApiCredentials }>(
      `/admin/tenants/${id}/owner/reset-password`,
      {
        method: 'POST',
      },
    );
    return { ok: true, credentials: toCredentials(res.credentials) };
  } catch (e) {
    return toFormError(e);
  }
}

export async function setTenantStatus(
  id: string,
  status: 'active' | 'suspended',
  _: FormState,
): Promise<FormState> {
  try {
    await api(`/admin/tenants/${id}`, { method: 'PATCH', body: { status } });
  } catch (e) {
    return toFormError(e);
  }
  revalidatePath('/tenants');
  return { ok: true };
}
