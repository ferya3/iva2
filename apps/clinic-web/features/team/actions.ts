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

export async function addMember(_: FormState, form: FormData): Promise<FormState> {
  let credentials: ApiCredentials | null = null;
  try {
    const res = await api<{ credentials: ApiCredentials | null }>('/tenant/members', {
      method: 'POST',
      body: { email: form.get('email'), name: form.get('name') || null, role: form.get('role') },
    });
    credentials = res.credentials;
  } catch (e) {
    return { ...toFormError(e), values: formValues(form) };
  }
  revalidatePath('/team');
  return credentials
    ? { ok: true, message: 'عضو جدید اضافه شد.', credentials: toCredentials(credentials) }
    : {
        ok: true,
        message: `عضو اضافه شد. ${String(form.get('email'))} از قبل حساب داشت و با همان رمز قبلی خود وارد می‌شود.`,
      };
}

/** New temporary password for a member who lost theirs. */
export async function resetMemberPassword(id: number, _: FormState): Promise<FormState> {
  try {
    const res = await api<{ credentials: ApiCredentials }>(`/tenant/members/${id}/reset-password`, {
      method: 'POST',
    });
    return { ok: true, credentials: toCredentials(res.credentials) };
  } catch (e) {
    return toFormError(e);
  }
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
