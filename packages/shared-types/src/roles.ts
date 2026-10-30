/** Platform-wide role (admin-web). Clinic roles are scoped per tenant. */
export const PlatformRole = {
  SuperAdmin: 'super_admin',
  Support: 'support',
} as const;
export type PlatformRole = (typeof PlatformRole)[keyof typeof PlatformRole];

export const TenantRole = {
  Owner: 'owner',
  Admin: 'admin',
  Clinician: 'clinician',
  Assistant: 'assistant',
} as const;
export type TenantRole = (typeof TenantRole)[keyof typeof TenantRole];

export const Permission = {
  TenantManage: 'tenant.manage',
  MembersManage: 'members.manage',
  PatientsView: 'patients.view',
  PatientsManage: 'patients.manage',
  SessionsView: 'sessions.view',
  SessionsManage: 'sessions.manage',
  ReportsView: 'reports.view',
  ReportsGenerate: 'reports.generate',
  BillingManage: 'billing.manage',
} as const;
export type Permission = (typeof Permission)[keyof typeof Permission];
