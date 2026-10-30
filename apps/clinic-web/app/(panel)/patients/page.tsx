import type { Metadata } from 'next';
import Link from 'next/link';
import { Search } from 'lucide-react';
import { Card, EmptyState, Input, PageHeader, Table, Td, Th, buttonVariants, faDate, faNumber } from '@cognitest/ui';
import { api } from '@/lib/api';
import type { Paginated, Patient } from '@/lib/types';
import { Pagination } from '@/components/pagination';

export const metadata: Metadata = { title: 'مراجعه‌کنندگان' };

const SEX = { female: 'زن', male: 'مرد', other: 'سایر' } as const;

export default async function PatientsPage({ searchParams }: PageProps<'/patients'>) {
  const params = await searchParams;
  const q = typeof params.q === 'string' ? params.q : '';
  const page = typeof params.page === 'string' ? params.page : '1';
  const res = await api<Paginated<Patient>>('/patients', { query: { q, page } });

  return (
    <>
      <PageHeader title="مراجعه‌کنندگان" description="پرونده‌های ثبت‌شده در کلینیک" actions={<Link href="/patients/new" className={buttonVariants()}>ثبت مراجعه‌کننده</Link>} />
      <Card>
        <form className="flex gap-2 border-b border-slate-100 p-4" role="search">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input name="q" defaultValue={q} placeholder="جستجو با نام، کد پرونده یا کد ملی" className="ps-9" />
          </div>
        </form>
        {res.data.length === 0 ? (
          <EmptyState title={q ? 'نتیجه‌ای یافت نشد' : 'هنوز مراجعه‌کننده‌ای ثبت نشده است'} />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>کد پرونده</Th>
                <Th>نام</Th>
                <Th>سن</Th>
                <Th>جنسیت</Th>
                <Th>تعداد آزمون</Th>
                <Th>تاریخ ثبت</Th>
              </tr>
            </thead>
            <tbody>
              {res.data.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50">
                  <Td>
                    <Link href={`/patients/${p.id}`} className="ltr font-medium text-brand-700 hover:underline">{p.patient_code}</Link>
                  </Td>
                  <Td>{[p.first_name, p.last_name].filter(Boolean).join(' ') || '—'}</Td>
                  <Td>{faNumber(p.age_years)}</Td>
                  <Td>{p.sex ? SEX[p.sex] : '—'}</Td>
                  <Td>{faNumber(p.sessions_count ?? 0)}</Td>
                  <Td>{faDate(p.created_at)}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
        <Pagination meta={res.meta} basePath="/patients" query={{ q }} />
      </Card>
    </>
  );
}
