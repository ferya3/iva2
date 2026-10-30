'use server';

import { revalidatePath } from 'next/cache';
import { api, toFormError, type FormState } from '@/lib/api';

export async function addMember(_: FormState, form: FormData): Promise<FormState> {
  let password: string | null = null;
  try {
    const res = await api<{ temporary_password: string | null }>('/tenant/members', {
      method: 'POST',
      body: { email: form.get('email'), name: form.get('name') || null, role: form.get('role') },
    });
    password = res.temporary_password;
  } catch (e) {
    return toFormError(e);
  }
  revalidatePath('/team');
  return {
    ok: true,
    message: password
      ? `عضو جدید اضافه شد. رمز موقت: ${password} — آن را به فرد بدهید (فقط همین یک‌بار نمایش داده می‌شود).`
      : 'عضو اضافه شد؛ با حساب و رمز فعلی خود وارد می‌شود.',
  };
}

export async function setMemberStatus(
  id: number,
  status: 'active' | 'disabled',
  _: FormState,
): Promise<FormState> {
  try {
    await api(`/tenant/members/${id}`, { method: 'PATCH', body: { status } });
  } catch (e) {
    return toFormError(e);
  }
  revalidatePath('/team');
  return { ok: true };
}
