import {
  Alert,
  Badge,
  Card,
  CardHeader,
  PageHeader,
  Table,
  Td,
  Th,
  faDate,
  faNumber,
} from '@cognitest/ui';
import { api } from '@/lib/api';
import { ActionButton } from '@/components/action-button';
import { changeVersionStatus } from '@/features/assessments/actions';

export const metadata = { title: 'کاتالوگ آزمون‌ها' };

interface Version {
  id: string;
  version: string;
  status: 'draft' | 'published' | 'retired';
  is_clinical: boolean;
  estimated_duration_seconds: number;
  published_at: string | null;
}
interface Type {
  id: string;
  key: string;
  name: string;
  category: string;
  description: string | null;
  versions: Version[];
}
const STATUS = {
  draft: { fa: 'پیش‌نویس', tone: 'neutral' },
  published: { fa: 'منتشرشده', tone: 'success' },
  retired: { fa: 'بازنشسته', tone: 'warning' },
} as const;

export default async function AssessmentsPage() {
  const { data } = await api<{ data: Type[] }>('/admin/assessments');
  return (
    <>
      <PageHeader
        title="کاتالوگ آزمون‌ها"
        description="نسخه‌های منتشرشده تغییرناپذیرند؛ هر تغییر پارامتر یک نسخه جدید می‌سازد."
      />
      <Alert tone="info" className="mb-6">
        نسخه جدید از طریق API ثبت می‌شود (
        <span className="ltr">POST /admin/assessment-types/&#123;type&#125;/versions</span>) تا
        تعریف پروتکل همراه با بازبینی کد در مخزن نگهداری شود.
      </Alert>
      <div className="space-y-6">
        {data.map((t) => (
          <Card key={t.id}>
            <CardHeader
              title={t.name}
              description={
                <>
                  <span className="ltr">{t.key}</span> · {t.category}
                </>
              }
            />
            <Table>
              <thead>
                <tr>
                  <Th>نسخه</Th>
                  <Th>وضعیت</Th>
                  <Th>نوع</Th>
                  <Th>مدت</Th>
                  <Th>انتشار</Th>
                  <Th />
                </tr>
              </thead>
              <tbody>
                {t.versions.map((v) => (
                  <tr key={v.id}>
                    <Td>
                      <span className="ltr font-mono">{v.version}</span>
                    </Td>
                    <Td>
                      <Badge tone={STATUS[v.status].tone}>{STATUS[v.status].fa}</Badge>
                    </Td>
                    <Td>{v.is_clinical ? 'بالینی' : 'غیربالینی'}</Td>
                    <Td>{faNumber(Math.round(v.estimated_duration_seconds / 60))} دقیقه</Td>
                    <Td>{faDate(v.published_at)}</Td>
                    <Td>
                      {v.status === 'draft' ? (
                        <ActionButton
                          action={changeVersionStatus.bind(null, v.id, 'publish')}
                          size="sm"
                          confirm="پس از انتشار، تعریف این نسخه قابل تغییر نیست."
                        >
                          انتشار
                        </ActionButton>
                      ) : v.status === 'published' ? (
                        <ActionButton
                          action={changeVersionStatus.bind(null, v.id, 'retire')}
                          size="sm"
                          variant="ghost"
                          confirm="کلینیک‌ها دیگر نمی‌توانند جلسه جدید با این نسخه بسازند."
                        >
                          بازنشسته‌سازی
                        </ActionButton>
                      ) : null}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </Card>
        ))}
      </div>
    </>
  );
}
