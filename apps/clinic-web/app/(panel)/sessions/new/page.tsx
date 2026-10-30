import type { Metadata } from 'next';
import Link from 'next/link';
import { Alert, Card, CardBody, PageHeader } from '@cognitest/ui';
import { api } from '@/lib/api';
import type { AssessmentType, Paginated, Patient } from '@/lib/types';
import { SessionForm } from '@/features/sessions/session-form';

export const metadata: Metadata = { title: 'آزمون جدید' };

export default async function NewSessionPage({ searchParams }: PageProps<'/sessions/new'>) {
  const { patient } = await searchParams;
  const [patients, types] = await Promise.all([
    api<Paginated<Patient>>('/patients', { query: { per_page: 100 } }),
    api<{ data: AssessmentType[] }>('/assessment-types'),
  ]);

  return (
    <>
      <PageHeader
        title="آزمون جدید"
        description="جلسه آزمون بسازید و کد ورود برنامه دسکتاپ را صادر کنید."
      />
      <Card className="max-w-2xl">
        <CardBody>
          {patients.data.length === 0 ? (
            <Alert tone="info">
              ابتدا یک مراجعه‌کننده{' '}
              <Link href="/patients/new" className="font-semibold underline">
                ثبت کنید
              </Link>
              .
            </Alert>
          ) : (
            <SessionForm
              patients={patients.data}
              types={types.data}
              patientId={typeof patient === 'string' ? patient : undefined}
            />
          )}
        </CardBody>
      </Card>
    </>
  );
}
