'use server';

import { api, toFormError, type FormState } from '@/lib/api';

export async function changePassword(_: FormState, form: FormData): Promise<FormState> {
  const current = String(form.get('current_password') ?? '');
  const password = String(form.get('password') ?? '');
  const confirmation = String(form.get('password_confirmation') ?? '');
  if (password.length < 8) {
    return { ok: false, errors: { password: ['رمز جدید باید دست‌کم ۸ نویسه باشد.'] } };
  }
  if (password !== confirmation) {
    return { ok: false, errors: { password_confirmation: ['تکرار رمز با رمز جدید یکسان نیست.'] } };
  }
  if (password === current) {
    return { ok: false, errors: { password: ['رمز جدید باید با رمز فعلی فرق داشته باشد.'] } };
  }
  try {
    await api('/auth/password', {
      method: 'POST',
      body: { current_password: current, password, password_confirmation: confirmation },
    });
  } catch (e) {
    const state = toFormError(e);
    if (state.errors?.current_password) {
      return { ok: false, errors: { current_password: ['رمز فعلی درست نیست.'] } };
    }
    return state;
  }
  return {
    ok: true,
    message:
      'رمز عبور تغییر کرد. از این پس با رمز جدید وارد شوید؛ دستگاه‌های دیگر از حساب خارج شدند.',
  };
}
