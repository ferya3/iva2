'use client';

import { Alert, Button } from '@cognitest/ui';

export default function PanelError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="mx-auto max-w-lg py-16">
      <Alert tone="danger" title="بارگذاری این صفحه با خطا روبه‌رو شد">
        اتصال به سرور را بررسی کنید و دوباره تلاش کنید.
      </Alert>
      <Button className="mt-4" variant="secondary" onClick={reset}>
        تلاش دوباره
      </Button>
    </div>
  );
}
