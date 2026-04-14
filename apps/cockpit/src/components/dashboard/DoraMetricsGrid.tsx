'use client';
import { ArrowUpRight } from 'lucide-react';
import type { DoraMetricCard } from '@gitflow/shared';

const DEFAULT_METRICS: DoraMetricCard[] = [
  { title: 'Deployment Frequency', metric: '--', delta: 'Awaiting data' },
  { title: 'Lead Time for Changes', metric: '--', delta: 'Awaiting data' },
  { title: 'Change Failure Rate', metric: '--', delta: 'Awaiting data' },
  { title: 'MTTR', metric: '--', delta: 'Awaiting data' },
];

export function DoraMetricsGrid({ metrics = DEFAULT_METRICS }: { metrics?: DoraMetricCard[] }) {
  const displayMetrics = metrics.length ? metrics : DEFAULT_METRICS;

  return (
    <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
      {displayMetrics.map((item, index) => (
        <article
          key={item.title}
          className="panel overflow-hidden"
        >
          <div className="panel-body relative">
            <div className="absolute right-0 top-0 h-20 w-20 translate-x-5 -translate-y-5 rounded-full bg-cyan-300/10 blur-2xl" />
            <p className="text-xs uppercase tracking-[0.14em] text-slate-400">{item.title}</p>
            <p className="metric-mono mt-3 text-3xl font-semibold text-slate-100">{item.metric}</p>
            <div className="mt-4 flex items-center justify-between text-sm text-slate-300/85">
              <span>{item.delta}</span>
              <ArrowUpRight className={`h-4 w-4 ${index % 2 === 0 ? 'text-cyan-200' : 'text-amber-200'}`} />
            </div>
          </div>
        </article>
      ))}
    </section>
  );
}
