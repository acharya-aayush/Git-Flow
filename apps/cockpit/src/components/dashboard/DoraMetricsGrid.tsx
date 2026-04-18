'use client';
import { ArrowUpRightIcon } from '@primer/octicons-react';
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
      {displayMetrics.map((item) => (
        <article
          key={item.title}
          className="panel overflow-hidden"
        >
          <div className="panel-body">
            <p className="text-xs font-medium text-slate-400">{item.title}</p>
            <p className="metric-mono mt-2 text-3xl font-semibold text-slate-100">{item.metric}</p>
            <div className="mt-3 flex items-center justify-between text-sm text-slate-300/85">
              <span>{item.delta}</span>
              <ArrowUpRightIcon size={14} className="text-slate-500" />
            </div>
          </div>
        </article>
      ))}
    </section>
  );
}
