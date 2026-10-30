'use client';

import { useEffect, useRef } from 'react';

export function SessionsPerDayChart({ data }: { data: Record<string, number> }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let chart: { dispose(): void } | null = null;
    let disposed = false;
    void import('echarts').then((echarts) => {
      if (disposed || !ref.current) return;
      const days = Object.keys(data);
      const instance = echarts.init(ref.current, undefined, { renderer: 'svg' });
      chart = instance;
      instance.setOption({
        textStyle: { fontFamily: 'var(--font-vazirmatn), Tahoma' },
        grid: { left: 40, right: 16, top: 16, bottom: 28 },
        tooltip: { trigger: 'axis' },
        xAxis: { type: 'category', data: days.map((d) => d.slice(5)), inverse: true },
        yAxis: { type: 'value', minInterval: 1, position: 'right' },
        series: [{ type: 'bar', data: days.map((d) => data[d]), itemStyle: { color: '#0d9488', borderRadius: [3, 3, 0, 0] } }],
      });
    });
    return () => {
      disposed = true;
      chart?.dispose();
    };
  }, [data]);
  return <div ref={ref} className="h-64 w-full" role="img" aria-label="تعداد جلسات در ۳۰ روز اخیر" />;
}
