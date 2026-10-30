'use server';

import { revalidatePath } from 'next/cache';
import { api, toFormError, type FormState } from '@/lib/api';

export async function createTenant(_: FormState, form: FormData): Promise<FormState> {
  let password: string | null = null;
  try {
    const res = await api<{ owner_temporary_password: string | null }>('/admin/tenants', {
      method: 'POST',
      body: {
        name: form.get('name'),
        city: form.get('city') || null,
        owner_name: form.get('owner_name'),
        owner_email: form.get('owner_email'),
        plan: form.get('plan'),
      },
    });
    password = res.owner_temporary_password;
  } catch (e) {
    return toFormError(e);
  }
  revalidatePath('/tenants');
  return {
    ok: true,
    message: password
      ? `کلینیک ایجاد شد. ورود مالک: ${String(form.get('owner_email'))} — رمز موقت: ${password} (فقط همین یک‌بار نمایش داده می‌شود)`
      : 'کلینیک ایجاد شد. مالک با حساب و رمز فعلی خود وارد می‌شود.',
  };
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
