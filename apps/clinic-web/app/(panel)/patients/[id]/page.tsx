import type { Metadata } from 'next';
import Link from 'next/link';
import { Card, CardBody, CardHeader, EmptyState, PageHeader, SessionStatusBadge, Table, Td, Th, ValidityBadge, buttonVariants, faDate } from '@cognitest/ui';
import { api } from '@/lib/api';
import type { Paginated, Patient, Session } from '@/lib/types';
import { PatientForm } from '@/features/patients/patient-form';
import { updatePatient } from '@/features/patients/actions';

export const metadata: Metadata = { title: 'پرونده مراجعه‌کننده' };

export default async function PatientPage({ params }: PageProps<'/patients/[id]'>) {
  const { id } = await params;
  const [{ data: patient }, sessions] = await Promise.all([
    api<{ data: Patient }>(`/patients/${id}`),
    api<Paginated<Session>>(`/patients/${id}/sessions`),
  ]);
  const name = [patient.first_name, patient.last_name].filter(Boolean).join(' ');

  return (
    <>
      <PageHeader
        title={name || patient.patient_code}
        description={<span className="ltr">{patient.patient_code}</span>}
        actions={<Link href={`/sessions/new?patient=${patient.id}`} className={buttonVariants()}>آزمون جدید برای این مراجعه‌کننده</Link>}
      />
      <div className="grid gap-6 xl:grid-cols-5">
        <Card className="xl:col-span-3">
          <CardHeader title="سوابق آزمون" />
          {sessions.data.length === 0 ? (
            <EmptyState title="هنوز آزمونی انجام نشده است" />
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>آزمون</Th>
                  <Th>وضعیت</Th>
                  <Th>اعتبار</Th>
                  <Th>تاریخ</Th>
                </tr>
              </thead>
              <tbody>
                {sessions.data.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50">
                    <Td>
                      <Link href={`/sessions/${s.id}`} className="text-brand-700 hover:underline">
                        {s.assessment?.name ?? 'آزمون'} <span className="ltr text-xs text-slate-500">v{s.assessment?.version}</span>
                      </Link>
                    </Td>
                    <Td><SessionStatusBadge status={s.status} /></Td>
                    <Td><ValidityBadge status={s.validity_status} /></Td>
                    <Td>{faDate(s.created_at)}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card>
        <Card className="xl:col-span-2">
          <CardHeader title="اطلاعات پرونده" />
          <CardBody>
            <PatientForm action={updatePatient.bind(null, patient.id)} patient={patient} />
          </CardBody>
        </Card>
      </div>
    </>
  );
}
