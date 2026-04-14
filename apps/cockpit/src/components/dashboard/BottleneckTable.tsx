'use client';
import { useMemo, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import type { StalePrTableRow } from '@gitflow/shared';

export function BottleneckTable({ prs = [] }: { prs?: StalePrTableRow[] }) {
  const [sortKey, setSortKey] = useState<'prm' | 'author' | 'daysOpen' | 'status'>('daysOpen');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const onSort = (key: 'prm' | 'author' | 'daysOpen' | 'status') => {
    if (sortKey === key) {
      setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
      return;
    }
    setSortKey(key);
    setSortDir(key === 'daysOpen' ? 'desc' : 'asc');
  };

  const sorted = useMemo(() => {
    const values = [...prs];
    values.sort((a, b) => {
      const direction = sortDir === 'asc' ? 1 : -1;
      if (sortKey === 'daysOpen') {
        return (a.daysOpen - b.daysOpen) * direction;
      }
      const av = String(a[sortKey] || '').toLowerCase();
      const bv = String(b[sortKey] || '').toLowerCase();
      if (av < bv) return -1 * direction;
      if (av > bv) return 1 * direction;
      return 0;
    });
    return values;
  }, [prs, sortKey, sortDir]);

  const label = (key: 'prm' | 'author' | 'daysOpen' | 'status', text: string) => (
    <button
      type="button"
      className="inline-flex items-center gap-1 text-left text-xs uppercase tracking-wider text-slate-400 hover:text-slate-200"
      onClick={() => onSort(key)}
    >
      {text}
      {sortKey === key ? (sortDir === 'asc' ? '▲' : '▼') : ''}
    </button>
  );

  return (
    <section className="panel overflow-hidden">
      <div className="panel-header flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-[0.12em] text-slate-100">Stale Pull Requests</h3>
          <p className="mt-1 text-xs text-slate-400">Open for more than 48 hours with zero review activity</p>
        </div>
        <div className="rounded-full border border-amber-300/35 bg-amber-300/10 p-2">
          <AlertTriangle className="h-4 w-4 text-amber-200" />
        </div>
      </div>

      <div className="panel-body p-0">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-border/70 text-left text-xs uppercase tracking-wider text-slate-400">
                <th className="px-5 py-3 font-medium">{label('prm', 'PR')}</th>
                <th className="px-5 py-3 font-medium">{label('author', 'Author')}</th>
                <th className="px-5 py-3 font-medium">{label('daysOpen', 'Days Open')}</th>
                <th className="px-5 py-3 font-medium">{label('status', 'Status')}</th>
              </tr>
            </thead>
            <tbody>
              {sorted.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-5 py-7 text-center text-slate-400">
                    No stale pull requests right now.
                  </td>
                </tr>
              ) : (
                sorted.map((item) => (
                  <tr key={item.prm} className="border-b border-border/40 last:border-0">
                    <td className="px-5 py-3 font-semibold text-slate-100">{item.prm}</td>
                    <td className="px-5 py-3 text-slate-300">{item.author}</td>
                    <td className="px-5 py-3 metric-mono text-slate-100">{item.daysOpen}</td>
                    <td className="px-5 py-3">
                      <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${item.daysOpen > 5 ? 'border-red-300/40 bg-red-300/15 text-red-100' : 'border-amber-300/40 bg-amber-300/15 text-amber-100'}`}>
                        {item.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
