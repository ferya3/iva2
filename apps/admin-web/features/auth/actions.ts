'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { API_URL, COOKIE_SECURE, TOKEN_COOKIE } from '@/lib/config';
import { clientForwardedFor, type FormState } from '@/lib/api';

export async function login(_: FormState, form: FormData): Promise<FormState> {
  const forwardedFor = await clientForwardedFor();
  const res = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...(forwardedFor ? { 'X-Forwarded-For': forwardedFor } : {}),
    },
    body: JSON.stringify({
      email: form.get('email'),
      password: form.get('password'),
      device_name: 'admin-web',
    }),
    cache: 'no-store',
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) return { ok: false, message: 'ایمیل یا رمز عبور اشتباه است.' };
  if (body.user?.platform_role !== 'super_admin') {
    // Do not keep a token that cannot use this panel.
    await fetch(`${API_URL}/auth/logout`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${body.token}`, Accept: 'application/json' },
    });
    return { ok: false, message: 'این حساب دسترسی مدیریت سامانه ندارد.' };
  }
  const maxAge = Math.max(
    60,
    Math.floor((new Date(body.expires_at).getTime() - Date.now()) / 1000),
  );
  (await cookies()).set(TOKEN_COOKIE, body.token, {
    httpOnly: true,
    secure: COOKIE_SECURE,
    sameSite: 'strict',
    path: '/',
    maxAge,
  });
  redirect('/');
}

export async function logout(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(TOKEN_COOKIE)?.value;
  if (token)
    await fetch(`${API_URL}/auth/logout`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    }).catch(() => null);
  jar.delete(TOKEN_COOKIE);
  redirect('/login');
}
