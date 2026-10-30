import type { Metadata } from 'next';
import { Building2 } from 'lucide-react';
import { Card, EmptyState } from '@cognitest/ui';
import type { MeDto } from '@cognitest/shared-types';
import { api } from '@/lib/api';
import { selectClinic } from '@/features/auth/actions';
import { Logo } from '@/components/logo';

export const metadata: Metadata = { title: 'انتخاب کلینیک' };

const ROLE_FA = { owner: 'مالک', admin: 'مدیر', clinician: 'متخصص', assistant: 'دستیار' } as const;

export default async function SelectClinicPage() {
  const me = await api<MeDto>('/auth/me', { tenantless: true });
  return (
    <main className="mx-auto max-w-lg p-6 pt-16">
      <Logo className="mb-6 text-xl" />
      <h1 className="mb-1 text-xl font-bold">انتخاب کلینیک</h1>
      <p className="mb-6 text-sm text-slate-500">{me.user.name}، با کدام کلینیک کار می‌کنید؟</p>
      <Card>
        {me.memberships.length === 0 ? (
          <EmptyState
            title="عضو هیچ کلینیکی نیستید"
            description="از مدیر کلینیک بخواهید شما را به تیم اضافه کند."
          />
        ) : (
          <ul className="divide-y divide-slate-100">
            {me.memberships.map((m) => (
              <li key={m.tenant_id}>
                <form action={selectClinic}>
                  <input type="hidden" name="tenant_id" value={m.tenant_id} />
                  <button className="flex w-full cursor-pointer items-center gap-3 px-5 py-4 text-start hover:bg-slate-50">
                    <Building2 className="h-5 w-5 text-brand-600" />
                    <span className="flex-1 font-medium">{m.tenant_name}</span>
                    <span className="text-xs text-slate-500">{ROLE_FA[m.role]}</span>
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </main>
  );
}
