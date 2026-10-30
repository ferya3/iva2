/**
 * The complete surface between the sandboxed renderer and the main
 * process. The renderer has no Node.js, no filesystem and no network: it
 * can only call these functions (exposed by preload via contextBridge).
 */
import type { SessionEvent } from '@cognitest/shared-types';
import type { ProtocolDefinition } from '@cognitest/assessment-engine';

export interface PlayerSession {
  id: string;
  status: string;
  patient_code: string;
  clinic_name: string;
  last_sequence: number;
  seed: number | null;
  assessment: {
    key: string;
    name: string;
    version: string;
    is_clinical: boolean;
    min_engine_version: string;
    protocol: ProtocolDefinition;
    calibration_thresholds: Record<string, number | boolean> | null;
  };
}

export type Result<T> = { ok: true; data: T } | { ok: false; code: string; message: string };

export interface AppInfo {
  appVersion: string;
  engineVersion: string;
  platform: string;
  apiUrl: string;
}

export interface RendererDeviceInfo {
  screen: { width: number; height: number; scale_factor: number; color_depth: number };
  audio_output: string | null;
}

export interface CalibrationPayload {
  display: Record<string, number>;
  input: Record<string, number | null>;
  audio: Record<string, number | boolean | null>;
  verdict: 'pass' | 'warn' | 'fail';
  reasons: Array<{ code: string; message: string }>;
}

export type UploadState =
  | { phase: 'syncing'; pending: number; lastAcked: number; finalSequence: number | null }
  | { phase: 'waiting'; pending: number; retryInMs: number; lastError: string }
  | { phase: 'completed' }
  | { phase: 'failed'; reason: string };

export interface ResumeInfo {
  session: PlayerSession | null;
  /** A finished run whose upload has not completed yet. */
  pendingUpload: { sessionId: string; pending: number } | null;
}

export interface CognitestBridge {
  appInfo(): Promise<AppInfo>;
  resume(): Promise<ResumeInfo>;
  join(code: string): Promise<Result<PlayerSession>>;
  deviceCheck(info: RendererDeviceInfo): Promise<Result<{ status: string }>>;
  calibration(result: CalibrationPayload): Promise<Result<{ verdict: 'pass' | 'warn' | 'fail'; reasons: Array<{ code: string; message: string }>; status: string }>>;
  start(): Promise<Result<{ seed: number; offline: boolean }>>;
  /** Fire-and-forget, ordered: raw events into the encrypted outbox. */
  record(events: SessionEvent[]): void;
  finishRun(finalSequence: number): Promise<void>;
  onUploadState(listener: (state: UploadState) => void): () => void;
  onDeepLink(listener: (code: string) => void): () => void;
  setTestMode(on: boolean): Promise<void>;
  reset(): Promise<void>;
}

export const IPC = {
  appInfo: 'app:info',
  resume: 'session:resume',
  join: 'session:join',
  deviceCheck: 'session:device-check',
  calibration: 'session:calibration',
  start: 'session:start',
  record: 'outbox:record',
  finishRun: 'session:finish',
  uploadState: 'upload:state',
  deepLink: 'deep-link',
  testMode: 'window:test-mode',
  reset: 'session:reset',
} as const;
