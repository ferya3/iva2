import { useEffect, useState } from 'react';
import { ENGINE_VERSION } from '@cognitest/assessment-engine';
import { Alert, Button, Spinner } from '@cognitest/ui';
import type { PlayerSession } from '../../electron/ipc-contract';
import { Shell } from '../components/shell';
import { bridge, compareVersions, errorMessage } from '../services/bridge';

interface Check {
  label: string;
  ok: boolean;
  detail: string;
}

export function DeviceCheckScreen({ session, onPassed }: { session: PlayerSession; onPassed: () => void }) {
  const [checks, setChecks] = useState<Check[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const w = window.screen.width * window.devicePixelRatio;
    const h = window.screen.height * window.devicePixelRatio;
    setChecks([
      {
        label: 'سازگاری نسخه موتور آزمون',
        ok: compareVersions(ENGINE_VERSION, session.assessment.min_engine_version) >= 0,
        detail: `${ENGINE_VERSION} ≥ ${session.assessment.min_engine_version}`,
      },
      { label: 'وضوح نمایشگر', ok: w >= 1280 && h >= 720, detail: `${Math.round(w)}×${Math.round(h)}` },
      { label: 'پشتیبانی صدا (Web Audio)', ok: typeof AudioContext !== 'undefined', detail: '' },
      { label: 'شمارنده زمانی دقیق', ok: performance.timeOrigin > 0 && performance.now() > 0, detail: 'performance.now()' },
    ]);
  }, [session]);

  const allOk = checks.length > 0 && checks.every((c) => c.ok);

  const submit = async () => {
    setBusy(true);
    setError(null);
    const res = await bridge().deviceCheck({
      screen: {
        width: window.screen.width,
        height: window.screen.height,
        scale_factor: window.devicePixelRatio,
        color_depth: window.screen.colorDepth,
      },
      audio_output: null,
    });
    setBusy(false);
    if (res.ok) onPassed();
    else setError(errorMessage(res.code, res.message));
  };

  return (
    <Shell
      step={1}
      title="بررسی تجهیزات"
      footer={
        <Button size="lg" disabled={!allOk || busy} onClick={() => void submit()}>
          {busy ? <Spinner /> : null} ادامه به کالیبراسیون
        </Button>
      }
    >
      <dl className="mb-6 grid grid-cols-3 gap-4 rounded-xl bg-slate-50 p-4 text-sm">
        <div><dt className="text-slate-500">کلینیک</dt><dd className="font-medium">{session.clinic_name}</dd></div>
        <div><dt className="text-slate-500">کد مراجعه‌کننده</dt><dd className="ltr font-medium">{session.patient_code}</dd></div>
        <div><dt className="text-slate-500">آزمون</dt><dd className="font-medium">{session.assessment.name}</dd></div>
      </dl>
      <ul className="space-y-3">
        {checks.map((c) => (
          <li key={c.label} className="flex items-center justify-between rounded-lg px-4 py-3 ring-1 ring-slate-200">
            <span>{c.label}</span>
            <span className={c.ok ? 'text-emerald-600' : 'text-rose-600'}>
              <span className="ltr me-3 text-xs text-slate-400">{c.detail}</span>
              {c.ok ? '✓' : '✗'}
            </span>
          </li>
        ))}
      </ul>
      <Alert tone="info" className="mt-6">
        پیش از ادامه: برنامه‌های دیگر را ببندید، اعلان‌ها را خاموش کنید، رایانه را به برق وصل کنید و از هدفون یا بلندگوی ثابت استفاده کنید.
      </Alert>
      {error ? <Alert tone="danger" className="mt-4">{error}</Alert> : null}
    </Shell>
  );
}
