'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import type { SessionInviteDto } from '@cognitest/shared-types';
import { api, toFormError, type FormState } from '@/lib/api';

export async function createSession(_: FormState, form: FormData): Promise<FormState> {
  let id: string;
  try {
    const res = await api<{ data: { id: string } }>('/sessions', {
      method: 'POST',
      body: {
        patient_id: form.get('patient_id'),
        assessment_version_id: form.get('assessment_version_id'),
        notes: form.get('notes') || null,
      },
    });
    id = res.data.id;
  } catch (e) {
    return toFormError(e);
  }
  revalidatePath('/sessions');
  redirect(`/sessions/${id}?invite=1`);
}

export type InviteState = FormState & { invite?: SessionInviteDto };

export async function createInvite(sessionId: string, _: InviteState): Promise<InviteState> {
  try {
    const invite = await api<SessionInviteDto>(`/sessions/${sessionId}/invite`, { method: 'POST' });
    revalidatePath(`/sessions/${sessionId}`);
    return { ok: true, invite };
  } catch (e) {
    return toFormError(e);
  }
}

export async function cancelSession(
  sessionId: string,
  _: FormState,
  form: FormData,
): Promise<FormState> {
  try {
    await api(`/sessions/${sessionId}/cancel`, {
      method: 'POST',
      body: { reason: form.get('reason') || null },
    });
  } catch (e) {
    return toFormError(e);
  }
  revalidatePath(`/sessions/${sessionId}`);
  return { ok: true, message: 'جلسه لغو شد.' };
}

export async function rescoreSession(sessionId: string, _: FormState): Promise<FormState> {
  try {
    await api(`/sessions/${sessionId}/score`, { method: 'POST' });
  } catch (e) {
    return toFormError(e);
  }
  revalidatePath(`/sessions/${sessionId}`);
  return { ok: true, message: 'تحلیل مجدد در صف اجرا قرار گرفت.' };
}

export async function generateReport(sessionId: string, _: FormState): Promise<FormState> {
  try {
    await api(`/sessions/${sessionId}/reports`, { method: 'POST' });
  } catch (e) {
    return toFormError(e);
  }
  revalidatePath(`/sessions/${sessionId}`);
  return { ok: true, message: 'گزارش صادر شد. فایل PDF چند لحظه دیگر آماده می‌شود.' };
}
