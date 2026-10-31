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
import { AgeRangeForm } from '@/features/assessments/age-range-form';

export const metadata = { title: 'کاتالوگ آزمون‌ها' };

interface Version {
  id: string;
  version: string;
  status: 'draft' | 'published' | 'retired';
  is_clinical: boolean;
  estimated_duration_seconds: number;
  min_age_years: number | null;
  max_age_years: number | null;
  audience_label: string | null;
  age_range_label: string | null;
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
        description="نسخه‌های منتشرشده تغییرناپذیرند؛ هر تغییر پارامتر یک نسخه جدید می‌سازد. گروه سنی هر نسخه قابل ویرایش است و جلسهٔ جدید نسخهٔ متناسب با سن مراجع را می‌گیرد."
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
                  <Th>گروه سنی</Th>
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
                    <Td>
                      <span className="block">{v.audience_label ?? 'همهٔ سنین'}</span>
                      {v.age_range_label ? (
                        <span className="text-xs text-slate-500">{v.age_range_label}</span>
                      ) : null}
                      {v.status !== 'retired' ? (
                        <AgeRangeForm
                          versionId={v.id}
                          min={v.min_age_years}
                          max={v.max_age_years}
                          audience={v.audience_label}
                        />
                      ) : null}
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
