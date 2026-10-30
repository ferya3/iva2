'use server';

import { revalidatePath } from 'next/cache';
import { api, toFormError, type FormState } from '@/lib/api';

export async function createTenant(_: FormState, form: FormData): Promise<FormState> {
  try {
    await api('/admin/tenants', {
      method: 'POST',
      body: {
        name: form.get('name'),
        city: form.get('city') || null,
        owner_name: form.get('owner_name'),
        owner_email: form.get('owner_email'),
        plan: form.get('plan'),
      },
    });
  } catch (e) {
    return toFormError(e);
  }
  revalidatePath('/tenants');
  return { ok: true, message: 'کلینیک ایجاد شد.' };
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
