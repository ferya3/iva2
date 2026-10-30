import type { Permission, PlatformRole, TenantRole } from './roles';
import type { SessionStatus } from './session-status';

/** Envelope used by every paginated list endpoint of the API. */
export interface Paginated<T> {
  data: T[];
  meta: { current_page: number; per_page: number; total: number; last_page: number };
}

export interface ApiError {
  message: string;
  code?: string;
  errors?: Record<string, string[]>;
}

export interface UserDto {
  id: string;
  name: string;
  email: string;
  platform_role: PlatformRole | null;
  locale: 'fa' | 'en';
}

export interface TenantMembershipDto {
  tenant_id: string;
  tenant_name: string;
  tenant_slug: string;
  role: TenantRole;
  permissions: Permission[];
}

export interface MeDto {
  user: UserDto;
  memberships: TenantMembershipDto[];
}

export type TenantStatus = 'active' | 'suspended' | 'trial';

export interface TenantDto {
  id: string;
  name: string;
  slug: string;
  status: TenantStatus;
  created_at: string;
}

export interface PatientDto {
  id: string;
  patient_code: string;
  first_name: string | null;
  last_name: string | null;
  birth_date: string | null;
  sex: 'female' | 'male' | 'other' | null;
  handedness: 'right' | 'left' | 'ambidextrous' | null;
  created_at: string;
}

export interface AssessmentTypeDto {
  id: string;
  key: string;
  name: string;
  category: string;
  description: string | null;
}

export interface AssessmentVersionDto {
  id: string;
  assessment_type_id: string;
  version: string;
  status: 'draft' | 'published' | 'retired';
  is_clinical: boolean;
  estimated_duration_seconds: number;
}

export interface TestSessionDto {
  id: string;
  patient_id: string;
  assessment_version_id: string;
  status: SessionStatus;
  created_by: string;
  invited_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  validity_status: ValidityStatus | null;
  created_at: string;
}

export interface SessionInviteDto {
  session_id: string;
  /** Human-typable code (shown once; only its hash is stored). */
  code: string;
  deep_link: string;
  expires_at: string;
}

export type ValidityStatus = 'valid' | 'questionable' | 'invalid';

export interface MetricDto {
  key: string;
  value: number | null;
  unit: string | null;
  scope: string;
}

export interface SessionResultsDto {
  session_id: string;
  scoring_run_id: string;
  algorithm_version: string;
  validity_status: ValidityStatus;
  quality_flags: QualityFlagDto[];
  metrics: MetricDto[];
  scored_at: string;
}

export interface QualityFlagDto {
  code: string;
  severity: 'info' | 'warning' | 'critical';
  message: string;
  value?: number;
  threshold?: number;
}

export interface DashboardStatsDto {
  patients: number;
  completed_sessions: number;
  pending_sessions: number;
  clinicians: number;
  recent_sessions: Array<{
    id: string;
    patient_code: string;
    status: SessionStatus;
    created_at: string;
  }>;
}
