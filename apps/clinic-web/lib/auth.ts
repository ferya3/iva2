import 'server-only';
import { cache } from 'react';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import type { Permission } from '@cognitest/shared-types';
import { api } from './api';
import { TENANT_COOKIE } from './config';
import type { MeDto } from './types';

/** Current user + active membership, memoised per request. */
export const currentUser = cache(async () => {
  const me = await api<MeDto>('/auth/me', { tenantless: true });
  const tenantId = (await cookies()).get(TENANT_COOKIE)?.value;
  const membership = me.memberships.find((m) => m.tenant_id === tenantId);
  if (!membership) redirect('/select-clinic');
  return { user: me.user, membership, memberships: me.memberships };
});

export async function can(permission: Permission): Promise<boolean> {
  const { membership } = await currentUser();
  return membership.permissions.includes(permission);
}
