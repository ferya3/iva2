'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { api, toFormError, type FormState } from '@/lib/api';

const text = (form: FormData, key: string) => {
  const v = form.get(key);
  return typeof v === 'string' && v.trim() !== '' ? v.trim() : null;
};

function payload(form: FormData) {
  const guardianName = text(form, 'guardian_name');
  const consentBy = text(form, 'consent_by');
  return {
    patient_code: text(form, 'patient_code') ?? undefined,
    first_name: text(form, 'first_name'),
    last_name: text(form, 'last_name'),
    national_id: text(form, 'national_id'),
    birth_date: text(form, 'birth_date'),
    sex: text(form, 'sex'),
    handedness: text(form, 'handedness'),
    education: text(form, 'education'),
    phone: text(form, 'phone'),
    guardian: guardianName
      ? {
          full_name: guardianName,
          relation: text(form, 'guardian_relation') ?? 'other',
          phone: text(form, 'guardian_phone'),
        }
      : undefined,
    consent: consentBy ? { accepted_by_name: consentBy, version: '1.0' } : undefined,
  };
}

export async function createPatient(_: FormState, form: FormData): Promise<FormState> {
  let id: string;
  try {
    id = (await api<{ data: { id: string } }>('/patients', { method: 'POST', body: payload(form) }))
      .data.id;
  } catch (e) {
    return toFormError(e);
  }
  revalidatePath('/patients');
  redirect(`/patients/${id}`);
}

export async function updatePatient(id: string, _: FormState, form: FormData): Promise<FormState> {
  try {
    const { guardian: _g, consent: _c, ...body } = payload(form);
    await api(`/patients/${id}`, { method: 'PATCH', body });
  } catch (e) {
    return toFormError(e);
  }
  revalidatePath(`/patients/${id}`);
  return { ok: true, message: 'اطلاعات ذخیره شد.' };
}
