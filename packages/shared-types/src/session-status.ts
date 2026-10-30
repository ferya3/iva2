/**
 * Lifecycle of a test session. The API (app/Domain/Sessions/SessionStatus.php)
 * mirrors this table exactly; tests on both sides pin the transition matrix.
 */
export const SessionStatus = {
  Created: 'CREATED',
  Invited: 'INVITED',
  DeviceCheck: 'DEVICE_CHECK',
  Calibration: 'CALIBRATION',
  Ready: 'READY',
  Running: 'RUNNING',
  Uploading: 'UPLOADING',
  Completed: 'COMPLETED',
  Validated: 'VALIDATED',
  Reported: 'REPORTED',
  Invalid: 'INVALID',
  Cancelled: 'CANCELLED',
  Expired: 'EXPIRED',
} as const;

export type SessionStatus = (typeof SessionStatus)[keyof typeof SessionStatus];

export const SESSION_TRANSITIONS: Readonly<Record<SessionStatus, readonly SessionStatus[]>> = {
  CREATED: ['INVITED', 'CANCELLED'],
  INVITED: ['DEVICE_CHECK', 'CANCELLED', 'EXPIRED'],
  DEVICE_CHECK: ['CALIBRATION', 'CANCELLED'],
  CALIBRATION: ['READY', 'DEVICE_CHECK', 'CANCELLED'],
  READY: ['RUNNING', 'CANCELLED'],
  RUNNING: ['UPLOADING', 'INVALID'],
  UPLOADING: ['COMPLETED', 'INVALID'],
  COMPLETED: ['VALIDATED', 'INVALID'],
  VALIDATED: ['REPORTED'],
  REPORTED: [],
  INVALID: [],
  CANCELLED: [],
  EXPIRED: [],
};

export function canTransition(from: SessionStatus, to: SessionStatus): boolean {
  return SESSION_TRANSITIONS[from].includes(to);
}

export function isTerminal(status: SessionStatus): boolean {
  return SESSION_TRANSITIONS[status].length === 0;
}

/** Statuses during which the desktop player may upload raw events. */
export const EVENT_INGEST_STATUSES: readonly SessionStatus[] = ['RUNNING', 'UPLOADING'];

/** Persian labels and UI tone for every status (panels and player). */
export const SESSION_STATUS_META: Readonly<
  Record<
    SessionStatus,
    {
      fa: string;
      en: string;
      tone: 'neutral' | 'info' | 'progress' | 'success' | 'warning' | 'danger';
    }
  >
> = {
  CREATED: { fa: 'ایجاد شده', en: 'Created', tone: 'neutral' },
  INVITED: { fa: 'دعوت ارسال شده', en: 'Invited', tone: 'info' },
  DEVICE_CHECK: { fa: 'بررسی تجهیزات', en: 'Device check', tone: 'progress' },
  CALIBRATION: { fa: 'کالیبراسیون', en: 'Calibration', tone: 'progress' },
  READY: { fa: 'آماده اجرا', en: 'Ready', tone: 'progress' },
  RUNNING: { fa: 'در حال اجرا', en: 'Running', tone: 'progress' },
  UPLOADING: { fa: 'در حال ارسال داده', en: 'Uploading', tone: 'progress' },
  COMPLETED: { fa: 'تکمیل‌شده (در حال تحلیل)', en: 'Completed', tone: 'info' },
  VALIDATED: { fa: 'تحلیل‌شده', en: 'Validated', tone: 'success' },
  REPORTED: { fa: 'گزارش صادر شده', en: 'Reported', tone: 'success' },
  INVALID: { fa: 'نامعتبر', en: 'Invalid', tone: 'danger' },
  CANCELLED: { fa: 'لغو شده', en: 'Cancelled', tone: 'neutral' },
  EXPIRED: { fa: 'منقضی شده', en: 'Expired', tone: 'warning' },
};
