import type { Metadata } from 'next';
import { Card, CardBody, PageHeader } from '@cognitest/ui';
import { api } from '@/lib/api';
import { can } from '@/lib/auth';
import { ClinicForm, type Clinic } from '@/features/settings/clinic-form';

export const metadata: Metadata = { title: 'تنظیمات کلینیک' };

export default async function SettingsPage() {
  const [{ data: clinic }, editable] = await Promise.all([
    api<{ data: Clinic }>('/tenant'),
    can('tenant.manage'),
  ]);
  return (
    <>
      <PageHeader title="تنظیمات کلینیک" />
      <Card className="max-w-3xl">
        <CardBody>
          <ClinicForm clinic={clinic} editable={editable} />
        </CardBody>
      </Card>
    </>
  );
}
