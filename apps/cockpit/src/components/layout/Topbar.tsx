'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useGitFlowStore } from '@/lib/store';
import { useWebsocket } from '@/lib/websocket';
import { Activity, CircleDot } from 'lucide-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

const TITLES: Record<string, string> = {
  '/': 'Overview',
  '/stability': 'Repository Stability',
  '/heatmap': 'Codebase Heatmap',
  '/issues': 'Issue Resolution',
  '/contributors': 'Contributor Network',
  '/bottlenecks': 'Bottlenecks',
  '/prs': 'Realtime Repository Feed',
};

export function Topbar() {
  const wsUrl = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3001/ws';
  useWebsocket(wsUrl);

  const isConnected = useGitFlowStore((state) => state.isConnected);
  const connectionError = useGitFlowStore((state) => state.connectionError);
  const livePRs = useGitFlowStore((state) => state.livePRs);
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const title = TITLES[pathname] || 'GitFlow';

  const [repositories, setRepositories] = useState<string[]>([]);
  const [repoSearch, setRepoSearch] = useState('');

  const selectedRepo = useMemo(() => searchParams.get('repo') || 'all', [searchParams]);
  const selectedWindow = useMemo(() => searchParams.get('window') || '30d', [searchParams]);

  const visibleRepositories = useMemo(() => {
    if (!repoSearch.trim()) {
      return repositories;
    }
    const q = repoSearch.toLowerCase();
    return repositories.filter((repo) => repo.toLowerCase().includes(q));
  }, [repositories, repoSearch]);

  const onRepoChange = useCallback((repo: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (!repo || repo === 'all') {
      params.delete('repo');
    } else {
      params.set('repo', repo);
    }
    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  }, [pathname, router, searchParams]);

  const onWindowChange = useCallback((windowValue: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (!windowValue || windowValue === '30d') {
      params.delete('window');
    } else {
      params.set('window', windowValue);
    }
    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  }, [pathname, router, searchParams]);

  useEffect(() => {
    const query = repoSearch.trim().toLowerCase();
    if (!query) {
      return;
    }

    const exact = repositories.find((repo) => repo.toLowerCase() === query);
    if (exact && exact !== selectedRepo) {
      onRepoChange(exact);
      return;
    }

    const firstMatch = visibleRepositories[0];
    if (!firstMatch || firstMatch === selectedRepo) {
      return;
    }

    const timer = window.setTimeout(() => {
      onRepoChange(firstMatch);
    }, 200);

    return () => {
      window.clearTimeout(timer);
    };
  }, [onRepoChange, repoSearch, repositories, selectedRepo, visibleRepositories]);

  useEffect(() => {
    let cancelled = false;

    const loadRepos = async () => {
      try {
        const response = await fetch('/api/repositories', { cache: 'no-store' });
        const payload = await response.json();
        if (!cancelled) {
          setRepositories(Array.isArray(payload.repositories) ? payload.repositories : []);
        }
      } catch {
        if (!cancelled) {
          setRepositories([]);
        }
      }
    };

    loadRepos();

    return () => {
      cancelled = true;
    };
  }, []);

  // Trigger a full Next.js server component re-render when a new live PR event arrives
  useEffect(() => {
    if (livePRs.length > 0) {
      router.refresh();
    }
  }, [livePRs, router]);

  return (
    <header className="relative z-20 flex min-h-[72px] w-full flex-col gap-3 border-b border-border/70 bg-[#161b22]/85 px-4 py-3 backdrop-blur-sm sm:px-6 lg:flex-row lg:items-center lg:justify-between">
      <div>
        <p className="text-[11px] uppercase tracking-[0.22em] text-slate-400">GitFlow Analytics</p>
        <h1 className="mt-1 text-xl font-semibold text-slate-100">{title}</h1>
      </div>

      <div className="flex flex-wrap items-center gap-2 sm:gap-3">
        <div className="flex items-center gap-2 rounded-md border border-border bg-[#0d1117] px-2.5 py-1.5 text-xs text-slate-300">
          <span className="text-slate-400">Repository</span>
          <input
            value={repoSearch}
            onChange={(event) => setRepoSearch(event.target.value)}
            onKeyDown={(event) => {
              if (event.key !== 'Enter') {
                return;
              }

              const firstMatch = visibleRepositories[0];
              if (firstMatch) {
                onRepoChange(firstMatch);
              }
            }}
            placeholder="search..."
            className="w-24 rounded border border-border bg-[#161b22] px-2 py-1 text-xs text-slate-200 outline-none"
          />
          <select
            value={selectedRepo}
            onChange={(event) => onRepoChange(event.target.value)}
            className="max-w-[240px] rounded border border-border bg-[#0d1117] px-2 py-1 text-xs text-slate-100 outline-none"
          >
            <option value="all">All repositories</option>
            {visibleRepositories.map((repo) => (
              <option key={repo} value={repo}>
                {repo}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2 rounded-md border border-border bg-[#0d1117] px-2.5 py-1.5 text-xs text-slate-300">
          <span className="text-slate-400">Window</span>
          <select
            value={selectedWindow}
            onChange={(event) => onWindowChange(event.target.value)}
            className="rounded border border-border bg-[#0d1117] px-2 py-1 text-xs text-slate-100 outline-none"
          >
            <option value="7d">7d</option>
            <option value="30d">30d</option>
            <option value="90d">90d</option>
            <option value="all">All</option>
          </select>
        </div>

        <div className="hidden items-center gap-2 rounded-full border border-border bg-[#0d1117] px-3 py-1.5 text-xs text-slate-300 sm:flex">
          <CircleDot className="h-3.5 w-3.5 text-slate-400" />
          Unified Metrics View
        </div>

        <div className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium ${isConnected ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300' : 'border-amber-500/35 bg-amber-500/10 text-amber-200'}`}>
          <Activity className={`h-3.5 w-3.5 ${isConnected ? 'animate-pulse text-emerald-300' : 'text-amber-300'}`} />
          {isConnected ? 'Stream Online' : 'Disconnected'}
        </div>

        {connectionError ? (
          <div className="rounded-full border border-red-500/35 bg-red-500/10 px-3 py-1.5 text-xs text-red-200">
            {connectionError}
          </div>
        ) : null}

        {!isConnected && !connectionError ? (
          <div className="rounded-full border border-border bg-[#0d1117] px-3 py-1.5 text-xs text-slate-300">
            Waiting for websocket events
          </div>
        ) : null}
      </div>
    </header>
  );
}
