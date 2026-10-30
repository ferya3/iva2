'use server';

import { revalidatePath } from 'next/cache';
import { api, toFormError, type FormState } from '@/lib/api';

export async function addMember(_: FormState, form: FormData): Promise<FormState> {
  try {
    await api('/tenant/members', {
      method: 'POST',
      body: { email: form.get('email'), name: form.get('name') || null, role: form.get('role') },
    });
  } catch (e) {
    return toFormError(e);
  }
  revalidatePath('/team');
  return {
    ok: true,
    message: 'عضو جدید اضافه شد. کاربران جدید باید از «فراموشی رمز» رمز خود را تعیین کنند.',
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
