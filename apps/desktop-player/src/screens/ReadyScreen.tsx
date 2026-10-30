import { useState } from 'react';
import { Alert, Button, Spinner } from '@cognitest/ui';
import type { PlayerSession } from '../../electron/ipc-contract';
import { Shell } from '../components/shell';
import { bridge, errorMessage } from '../services/bridge';

export function ReadyScreen({ session, onStart }: { session: PlayerSession; onStart: (seed: number, offline: boolean) => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const clinical = session.assessment.is_clinical;

  const start = async () => {
    setBusy(true);
    setError(null);
    const res = await bridge().start();
    setBusy(false);
    if (res.ok) onStart(res.data.seed, res.data.offline);
    else setError(errorMessage(res.code, res.message));
  };

  return (
    <Shell
      step={3}
      title="آماده شروع آزمون"
      footer={
        <Button size="lg" disabled={busy} onClick={() => void start()}>
          {busy ? <Spinner /> : null} شروع آزمون (تمام‌صفحه)
        </Button>
      }
    >
      <ul className="space-y-2 leading-8 text-slate-700">
        <li>• آزمون به‌صورت تمام‌صفحه اجرا می‌شود و حدود ۷ دقیقه طول می‌کشد.</li>
        <li>• پیش از هر بخش، راهنمای همان بخش نمایش داده می‌شود.</li>
        <li>• در طول آزمون از پنجره خارج نشوید؛ خروج یا تغییر پنجره ثبت و در اعتبار نتیجه لحاظ می‌شود.</li>
        <li>• اگر اینترنت قطع شود، آزمون ادامه می‌یابد و داده‌ها بعداً ارسال می‌شوند.</li>
      </ul>
      {!clinical ? <Alert tone="warning" className="mt-6">این نسخه آزمون غیربالینی (نمایشی/پژوهشی) است.</Alert> : null}
      {error ? <Alert tone="danger" className="mt-4">{error}</Alert> : null}
    </Shell>
  );
}
