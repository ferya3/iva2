import type {
  MeDto,
  Paginated,
  PatientDto,
  SessionStatus,
  ValidityStatus,
} from '@cognitest/shared-types';

export type { MeDto, Paginated };

export interface Patient extends PatientDto {
  age_years: number | null;
  education: string | null;
  national_id?: string | null;
  phone?: string | null;
  sessions_count?: number;
}

export interface Session {
  id: string;
  patient_id: string;
  patient?: { id: string; patient_code: string };
  assessment_version_id: string;
  assessment?: { name: string; version: string; is_clinical: boolean };
  status: SessionStatus;
  validity_status: ValidityStatus | null;
  last_sequence: number;
  expected_final_sequence: number | null;
  engine_version: string | null;
  notes: string | null;
  invited_at: string | null;
  expires_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  calibration?: { verdict: 'pass' | 'warn' | 'fail'; refresh_rate_hz: number } | null;
  history?: Array<{
    from: string | null;
    to: SessionStatus;
    actor_type: string;
    reason: string | null;
    at: string;
  }>;
}

export interface Dashboard {
  patients: number;
  completed_sessions: number;
  pending_sessions: number;
  invalid_sessions: number;
  clinicians: number;
  sessions_this_month: number;
  subscription: {
    plan: string;
    status: string;
    ends_at: string | null;
    sessions_per_month: number | null;
  } | null;
  recent_sessions: Array<{
    id: string;
    patient_code: string;
    status: SessionStatus;
    validity_status: ValidityStatus | null;
    created_at: string;
  }>;
}

export interface AssessmentType {
  id: string;
  key: string;
  name: string;
  category: string;
  description: string | null;
  versions: Array<{
    id: string;
    version: string;
    is_clinical: boolean;
    estimated_duration_seconds: number;
  }>;
}

export interface Results {
  session_id: string;
  scoring_run_id: string;
  algorithm_version: string;
  validity_status: ValidityStatus;
  quality_flags: Array<{
    code: string;
    severity: 'info' | 'warning' | 'critical';
    message: string;
    value?: number;
    threshold?: number;
  }>;
  metrics: Array<{ key: string; value: number | null; unit: string | null; scope: string }>;
  scored_at: string;
}

export interface Member {
  id: number;
  user_id: string;
  name: string;
  email: string;
  role: 'owner' | 'admin' | 'clinician' | 'assistant';
  role_label: string;
  status: 'active' | 'disabled';
  joined_at: string;
}
