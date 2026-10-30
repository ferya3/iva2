'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import type { MeDto } from '@cognitest/shared-types';
import { API_URL, COOKIE_SECURE, TENANT_COOKIE, TOKEN_COOKIE } from '@/lib/config';
import { api, type FormState } from '@/lib/api';

const cookieOptions = (maxAge: number) => ({
  httpOnly: true,
  secure: COOKIE_SECURE,
  sameSite: 'lax' as const,
  path: '/',
  maxAge,
});

export async function login(_: FormState, form: FormData): Promise<FormState> {
  const res = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ email: form.get('email'), password: form.get('password'), device_name: 'clinic-web' }),
    cache: 'no-store',
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    return {
      ok: false,
      message:
        body.code === 'too_many_attempts'
          ? 'تعداد تلاش‌ها زیاد است؛ چند دقیقه دیگر دوباره امتحان کنید.'
          : 'ایمیل یا رمز عبور اشتباه است.',
    };
  }
  const jar = await cookies();
  const maxAge = Math.max(60, Math.floor((new Date(body.expires_at).getTime() - Date.now()) / 1000));
  jar.set(TOKEN_COOKIE, body.token, cookieOptions(maxAge));

  const me = await api<MeDto>('/auth/me', { tenantless: true });
  if (me.memberships.length === 1) {
    jar.set(TENANT_COOKIE, me.memberships[0]!.tenant_id, cookieOptions(60 * 60 * 24 * 30));
    const next = String(form.get('next') ?? '/');
    redirect(next.startsWith('/') && !next.startsWith('//') ? next : '/');
  }
  redirect('/select-clinic');
}

export async function selectClinic(form: FormData): Promise<void> {
  const tenantId = String(form.get('tenant_id'));
  const me = await api<MeDto>('/auth/me', { tenantless: true });
  if (!me.memberships.some((m) => m.tenant_id === tenantId)) redirect('/select-clinic');
  (await cookies()).set(TENANT_COOKIE, tenantId, cookieOptions(60 * 60 * 24 * 30));
  redirect('/');
}

export async function logout(): Promise<void> {
  try {
    await api('/auth/logout', { method: 'POST', tenantless: true });
  } finally {
    const jar = await cookies();
    jar.delete(TOKEN_COOKIE);
    jar.delete(TENANT_COOKIE);
  }
  redirect('/login');
}
