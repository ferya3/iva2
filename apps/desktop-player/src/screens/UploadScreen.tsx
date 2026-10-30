import { useEffect, useState } from 'react';
import { Alert, Button, Spinner } from '@cognitest/ui';
import type { UploadState } from '../../electron/ipc-contract';
import { Shell } from '../components/shell';
import { bridge } from '../services/bridge';

export function UploadScreen({ aborted, onDone }: { aborted: boolean; onDone: () => void }) {
  const [state, setState] = useState<UploadState>({ phase: 'syncing', pending: 0, lastAcked: 0, finalSequence: null });

  useEffect(() => bridge().onUploadState(setState), []);

  return (
    <Shell
      step={4}
      title={state.phase === 'completed' ? 'پایان آزمون' : 'ارسال داده‌های آزمون'}
      footer={state.phase === 'completed' ? <Button size="lg" onClick={onDone}>بازگشت به صفحه اول</Button> : null}
    >
      {aborted ? <Alert tone="warning" className="mb-4">آزمون پیش از پایان متوقف شد؛ داده‌های ثبت‌شده برای بررسی متخصص ارسال می‌شوند.</Alert> : null}
      {state.phase === 'syncing' ? (
        <div className="flex items-center gap-3 text-slate-700">
          <Spinner /> در حال ارسال… {state.pending > 0 ? `${state.pending.toLocaleString('fa-IR')} رویداد باقی مانده` : null}
        </div>
      ) : null}
      {state.phase === 'waiting' ? (
        <Alert tone="info" title="اتصال به سرور برقرار نیست">
          داده‌های آزمون به‌صورت رمزنگاری‌شده روی این رایانه ذخیره شده‌اند و پس از برقراری اتصال، خودکار ارسال می‌شوند. می‌توانید برنامه را باز بگذارید یا بعداً دوباره اجرا کنید.
        </Alert>
      ) : null}
      {state.phase === 'failed' ? (
        <Alert tone="danger" title="ارسال داده با خطا متوقف شد">
          داده‌ها روی این رایانه حفظ شده‌اند. لطفاً با پشتیبانی تماس بگیرید. <span className="ltr text-xs">({state.reason})</span>
        </Alert>
      ) : null}
      {state.phase === 'completed' ? (
        <Alert tone="success" title="داده‌ها با موفقیت ارسال شد">از همکاری شما سپاسگزاریم. نتیجه توسط متخصص بررسی می‌شود.</Alert>
      ) : null}
    </Shell>
  );
}
