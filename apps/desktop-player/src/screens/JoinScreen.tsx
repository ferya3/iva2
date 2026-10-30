import { useEffect, useState } from 'react';
import { Alert, Button, Input, Spinner } from '@cognitest/ui';
import type { PlayerSession } from '../../electron/ipc-contract';
import { Shell } from '../components/shell';
import { bridge, errorMessage } from '../services/bridge';

const normalize = (raw: string) =>
  raw
    .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
    .toUpperCase()
    .replace(/[^0-9A-Z]/g, '')
    .slice(0, 9);

const format = (code: string) => code.match(/.{1,3}/g)?.join('-') ?? '';

export function JoinScreen({ onJoined, initialCode }: { onJoined: (s: PlayerSession) => void; initialCode?: string | null }) {
  const [code, setCode] = useState(normalize(initialCode ?? ''));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (value = code) => {
    if (value.length !== 9) return;
    setBusy(true);
    setError(null);
    const res = await bridge().join(format(value));
    setBusy(false);
    if (res.ok) onJoined(res.data);
    else setError(errorMessage(res.code, res.message));
  };

  useEffect(() => {
    if (initialCode && normalize(initialCode).length === 9) void submit(normalize(initialCode));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialCode]);

  return (
    <Shell
      step={0}
      title="ورود به جلسه آزمون"
      footer={
        <Button size="lg" disabled={code.length !== 9 || busy} onClick={() => void submit()}>
          {busy ? <Spinner /> : null} ادامه
        </Button>
      }
    >
      <p className="mb-6 text-slate-600">کد ۹ کاراکتری که متخصص به شما داده است را وارد کنید.</p>
      <Input
        autoFocus
        dir="ltr"
        value={format(code)}
        onChange={(e) => setCode(normalize(e.target.value))}
        onKeyDown={(e) => e.key === 'Enter' && void submit()}
        placeholder="XXX-XXX-XXX"
        className="h-16 text-center font-mono text-3xl tracking-[0.3em]"
        aria-label="کد ورود"
      />
      {error ? <Alert tone="danger" className="mt-4">{error}</Alert> : null}
    </Shell>
  );
}
