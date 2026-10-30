import type { Metadata } from 'next';
import {
  Badge,
  Card,
  CardBody,
  CardHeader,
  PageHeader,
  Table,
  Td,
  Th,
  faDate,
} from '@cognitest/ui';
import { api } from '@/lib/api';
import type { Member } from '@/lib/types';
import { MemberForm } from '@/features/team/member-form';
import { ActionButton } from '@/features/sessions/action-button';
import { setMemberStatus } from '@/features/team/actions';

export const metadata: Metadata = { title: 'متخصصان' };

export default async function TeamPage() {
  const { data: members } = await api<{ data: Member[] }>('/tenant/members');
  return (
    <>
      <PageHeader
        title="متخصصان و کاربران"
        description="دسترسی هر عضو بر اساس نقش او در همین کلینیک تعیین می‌شود."
      />
      <div className="grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <Table>
            <thead>
              <tr>
                <Th>نام</Th>
                <Th>ایمیل</Th>
                <Th>نقش</Th>
                <Th>وضعیت</Th>
                <Th>عضویت از</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {members.map((m) => (
                <tr key={m.id}>
                  <Td className="font-medium text-slate-900">{m.name}</Td>
                  <Td>
                    <span className="ltr">{m.email}</span>
                  </Td>
                  <Td>{m.role_label}</Td>
                  <Td>
                    {m.status === 'active' ? (
                      <Badge tone="success">فعال</Badge>
                    ) : (
                      <Badge>غیرفعال</Badge>
                    )}
                  </Td>
                  <Td>{faDate(m.joined_at)}</Td>
                  <Td>
                    {m.role !== 'owner' ? (
                      <ActionButton
                        action={setMemberStatus.bind(
                          null,
                          m.id,
                          m.status === 'active' ? 'disabled' : 'active',
                        )}
                        variant="ghost"
                        size="sm"
                      >
                        {m.status === 'active' ? 'غیرفعال‌سازی' : 'فعال‌سازی'}
                      </ActionButton>
                    ) : null}
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>
        <Card>
          <CardHeader title="افزودن عضو" />
          <CardBody>
            <MemberForm />
          </CardBody>
        </Card>
      </div>
    </>
  );
}
