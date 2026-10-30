import type { Metadata } from 'next';
import { Card, CardBody, PageHeader } from '@cognitest/ui';
import { PatientForm } from '@/features/patients/patient-form';
import { createPatient } from '@/features/patients/actions';

export const metadata: Metadata = { title: 'ثبت مراجعه‌کننده' };

export default function NewPatientPage() {
  return (
    <>
      <PageHeader title="ثبت مراجعه‌کننده" description="اطلاعات هویتی جدا از داده‌های آزمون و به‌صورت رمزنگاری‌شده نگهداری می‌شوند." />
      <Card className="max-w-3xl">
        <CardBody>
          <PatientForm action={createPatient} />
        </CardBody>
      </Card>
    </>
  );
}
