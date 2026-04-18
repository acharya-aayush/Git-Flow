'use client';
import { useMemo, useState } from 'react';
import { AlertFillIcon } from '@primer/octicons-react';
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
        <div className="rounded-md border border-[#9e6a03]/40 bg-[#9e6a03]/16 p-2">
          <AlertFillIcon size={14} className="text-[#d29922]" />
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
                      <span className={`inline-flex rounded-sm border px-2.5 py-1 text-xs font-semibold ${item.daysOpen > 5 ? 'border-[#da3633]/45 bg-[#da3633]/20 text-[#f85149]' : 'border-[#9e6a03]/40 bg-[#9e6a03]/18 text-[#d29922]'}`}>
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
