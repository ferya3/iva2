import { useState } from 'react';
import { Alert, Button, Spinner } from '@cognitest/ui';
import type { PlayerSession } from '../../electron/ipc-contract';
import { Shell } from '../components/shell';
import {
  collectKeyPresses,
  evaluate,
  measureDisplayTiming,
  probeAudio,
} from '../assessment/calibrate';
import { toThresholds } from '../assessment/thresholds';
import { bridge, errorMessage } from '../services/bridge';

type Phase = 'intro' | 'display' | 'keys' | 'audio' | 'submitting' | 'result';

const REASONS: Record<string, string> = {
  'display.refresh_rate': 'نرخ نوسازی نمایشگر کمتر از حد لازم است.',
  'display.jitter': 'نوسان زمان‌بندی فریم‌ها زیاد است.',
  'display.dropped_frames': 'تعداد فریم‌های از دست رفته زیاد است.',
  'input.dispatch_latency': 'تأخیر پردازش صفحه‌کلید زیاد است؛ برنامه‌های دیگر را ببندید.',
  'audio.unavailable': 'خروجی صدا در دسترس نیست.',
  'audio.not_heard': 'صدای آزمایشی شنیده نشد؛ اتصال هدفون/بلندگو و میزان صدا را بررسی کنید.',
  'audio.output_latency': 'تأخیر خروجی صدا زیاد است؛ از خروجی صوتی دیگری استفاده کنید.',
};

export function CalibrationScreen({
  session,
  onReady,
}: {
  session: PlayerSession;
  onReady: (refreshRateHz: number) => void;
}) {
  const [phase, setPhase] = useState<Phase>('intro');
  const [presses, setPresses] = useState(0);
  const [audioProbe, setAudioProbe] = useState<Awaited<ReturnType<typeof probeAudio>> | null>(null);
  const [measured, setMeasured] = useState<{
    display: Awaited<ReturnType<typeof measureDisplayTiming>>;
    keys: Awaited<ReturnType<typeof collectKeyPresses>>;
  } | null>(null);
  const [outcome, setOutcome] = useState<{
    verdict: 'pass' | 'warn' | 'fail';
    reasons: Array<{ code: string; message: string }>;
    hz: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    setError(null);
    setOutcome(null);
    setPhase('display');
    const display = await measureDisplayTiming(3000);
    setPhase('keys');
    setPresses(0);
    const keys = await collectKeyPresses(5, setPresses);
    setMeasured({ display, keys });
    setPhase('audio');
    setAudioProbe(await probeAudio());
  };

  const finish = async (heard: boolean) => {
    if (!measured || !audioProbe) return;
    void audioProbe.ctx?.close();
    setPhase('submitting');
    const local = evaluate(
      measured.display,
      measured.keys,
      audioProbe.info,
      heard,
      toThresholds(session.assessment.calibration_thresholds),
    );
    // Resumed after a restart in READY: the server already accepted a
    // calibration; re-measure locally to get this run's refresh rate.
    if (session.status === 'READY') {
      setOutcome({
        verdict: local.verdict,
        reasons: local.reasons,
        hz: local.display.refresh_rate_hz,
      });
      setPhase('result');
      return;
    }
    const res = await bridge().calibration({
      display: { ...local.display },
      input: { ...local.input },
      audio: { ...local.audio },
      verdict: local.verdict,
      reasons: local.reasons,
    });
    if (!res.ok) {
      setError(errorMessage(res.code, res.message));
      setPhase('intro');
      return;
    }
    const reasons = [
      ...local.reasons,
      ...res.data.reasons.filter((r) => !local.reasons.some((l) => l.code === r.code)),
    ];
    setOutcome({ verdict: res.data.verdict, reasons, hz: local.display.refresh_rate_hz });
    setPhase('result');
  };

  return (
    <Shell
      step={2}
      title="کالیبراسیون"
      footer={
        phase === 'intro' ? (
          <Button size="lg" onClick={() => void run()}>
            شروع کالیبراسیون
          </Button>
        ) : phase === 'result' && outcome ? (
          outcome.verdict === 'fail' ? (
            <Button size="lg" variant="secondary" onClick={() => setPhase('intro')}>
              تکرار کالیبراسیون
            </Button>
          ) : (
            <Button size="lg" onClick={() => onReady(outcome.hz)}>
              ادامه
            </Button>
          )
        ) : null
      }
    >
      {phase === 'intro' ? (
        <p className="leading-8 text-slate-600">
          برای اطمینان از دقت زمانی آزمون، نمایشگر، صفحه‌کلید و صدا اندازه‌گیری می‌شوند. این مرحله
          حدود ۳۰ ثانیه طول می‌کشد. در طول اندازه‌گیری نمایشگر، به ماوس و صفحه‌کلید دست نزنید.
        </p>
      ) : null}
      {phase === 'display' ? (
        <div className="flex flex-col items-center gap-4 py-8">
          <div className="h-16 w-16 animate-spin rounded-full border-4 border-brand-200 border-t-brand-600" />
          <p className="text-slate-600">در حال اندازه‌گیری نمایشگر…</p>
        </div>
      ) : null}
      {phase === 'keys' ? (
        <div className="flex flex-col items-center gap-4 py-8 text-center">
          <p className="text-lg">
            کلید <kbd className="ltr rounded bg-slate-100 px-2 py-1 font-mono">Space</kbd> را ۵ بار
            فشار دهید.
          </p>
          <div className="flex gap-2">
            {[0, 1, 2, 3, 4].map((i) => (
              <span
                key={i}
                className={`h-4 w-4 rounded-full ${i < presses ? 'bg-brand-600' : 'bg-slate-200'}`}
              />
            ))}
          </div>
        </div>
      ) : null}
      {phase === 'audio' ? (
        <div className="flex flex-col items-center gap-4 py-8 text-center">
          {audioProbe ? (
            <>
              <p className="text-lg">آیا یک صدای «بیپ» کوتاه شنیدید؟</p>
              <div className="flex gap-3">
                <Button onClick={() => void finish(true)}>بله، شنیدم</Button>
                <Button variant="secondary" onClick={() => void finish(false)}>
                  خیر
                </Button>
                <Button variant="ghost" onClick={async () => setAudioProbe(await probeAudio())}>
                  پخش دوباره
                </Button>
              </div>
            </>
          ) : (
            <Spinner />
          )}
        </div>
      ) : null}
      {phase === 'submitting' ? (
        <div className="flex justify-center py-8">
          <Spinner className="h-8 w-8" />
        </div>
      ) : null}
      {phase === 'result' && outcome ? (
        <div className="space-y-3">
          <Alert
            tone={
              outcome.verdict === 'fail'
                ? 'danger'
                : outcome.verdict === 'warn'
                  ? 'warning'
                  : 'success'
            }
            title={
              outcome.verdict === 'fail'
                ? 'کالیبراسیون ناموفق بود'
                : outcome.verdict === 'warn'
                  ? 'کالیبراسیون با هشدار پذیرفته شد'
                  : 'تجهیزات آماده است'
            }
          >
            نرخ نوسازی نمایشگر: <span className="ltr">{outcome.hz} Hz</span>
          </Alert>
          {outcome.reasons.map((r) => (
            <p key={r.code} className="text-sm text-slate-600">
              • {REASONS[r.code] ?? r.message}
            </p>
          ))}
        </div>
      ) : null}
      {error ? (
        <Alert tone="danger" className="mt-4">
          {error}
        </Alert>
      ) : null}
    </Shell>
  );
}
