'use client';

import { useEffect, useRef } from 'react';

export interface BlockPoint {
  block: string;
  rtMean: number | null;
  hitRate: number | null;
}

/**
 * Per-block mean RT (bars) and hit rate (line) — the vigilance profile.
 * ECharts is loaded on demand so it never weighs on other pages.
 */
export function BlockChart({ points }: { points: BlockPoint[] }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let disposed = false;
    let chart: { dispose(): void; resize(): void } | null = null;
    const onResize = () => chart?.resize();
    void import('echarts').then((echarts) => {
      if (disposed || !ref.current) return;
      const instance = echarts.init(ref.current, undefined, { renderer: 'svg' });
      chart = instance;
      instance.setOption({
        textStyle: { fontFamily: 'var(--font-vazirmatn), Tahoma' },
        grid: { left: 56, right: 56, top: 24, bottom: 32 },
        tooltip: { trigger: 'axis' },
        xAxis: { type: 'category', data: points.map((p) => p.block), inverse: true },
        yAxis: [
          {
            type: 'value',
            name: 'ms',
            position: 'right',
            splitLine: { lineStyle: { color: '#eef2f7' } },
          },
          {
            type: 'value',
            min: 0,
            max: 1,
            position: 'left',
            axisLabel: { formatter: (v: number) => `${Math.round(v * 100)}%` },
            splitLine: { show: false },
          },
        ],
        series: [
          {
            name: 'میانگین زمان واکنش (ms)',
            type: 'bar',
            data: points.map((p) => p.rtMean),
            itemStyle: { color: '#14b8a6', borderRadius: [4, 4, 0, 0] },
            barMaxWidth: 36,
          },
          {
            name: 'نرخ پاسخ صحیح',
            type: 'line',
            yAxisIndex: 1,
            data: points.map((p) => p.hitRate),
            itemStyle: { color: '#6366f1' },
            smooth: true,
          },
        ],
      });
      window.addEventListener('resize', onResize);
    });
    return () => {
      disposed = true;
      window.removeEventListener('resize', onResize);
      chart?.dispose();
    };
  }, [points]);

  // HTML legend: ECharts' canvas legend mis-measures RTL text.
  return (
    <figure>
      <figcaption className="mb-2 flex flex-wrap gap-4 text-xs text-slate-600">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-[#14b8a6]" /> میانگین زمان واکنش (میلی‌ثانیه)
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-0.5 w-4 bg-[#6366f1]" /> نرخ پاسخ صحیح
        </span>
        <span className="text-slate-400">به تفکیک بلوک آزمون</span>
      </figcaption>
      <div ref={ref} className="h-72 w-full" role="img" aria-label="نمودار عملکرد به تفکیک بلوک" />
    </figure>
  );
}
