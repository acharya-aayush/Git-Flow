'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useGitFlowStore } from '@/lib/store';
import { useWebsocket } from '@/lib/websocket';
import {
  DotFillIcon,
  PulseIcon,
  RepoIcon,
  SearchIcon,
  XIcon,
} from '@primer/octicons-react';
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

type RepositorySearchControlProps = {
  selectedRepoValue: string;
  repositories: string[];
  onRepoChange: (repo: string) => void;
};

function RepositorySearchControl({
  selectedRepoValue,
  repositories,
  onRepoChange,
}: RepositorySearchControlProps) {
  const [repoSearch, setRepoSearch] = useState(selectedRepoValue);

  const visibleRepositories = useMemo(() => {
    if (!repoSearch.trim()) {
      return repositories;
    }
    const q = repoSearch.toLowerCase();
    return repositories.filter((repo) => repo.toLowerCase().includes(q));
  }, [repositories, repoSearch]);

  const autoApplyRepositoryQuery = useCallback((rawValue: string) => {
    const query = rawValue.trim();
    if (!query) {
      onRepoChange('all');
      return;
    }

    const lowerQuery = query.toLowerCase();
    const exact = repositories.find((repo) => repo.toLowerCase() === lowerQuery);
    if (exact) {
      onRepoChange(exact);
      return;
    }

    const firstMatch = repositories.find((repo) => repo.toLowerCase().includes(lowerQuery));
    if (firstMatch) {
      onRepoChange(firstMatch);
    }
  }, [onRepoChange, repositories]);

  useEffect(() => {
    if (repoSearch === selectedRepoValue) {
      return;
    }

    const timer = window.setTimeout(() => {
      autoApplyRepositoryQuery(repoSearch);
    }, 180);

    return () => {
      window.clearTimeout(timer);
    };
  }, [autoApplyRepositoryQuery, repoSearch, selectedRepoValue]);

  return (
    <div className="boneyard-bar flex items-center gap-2 px-2.5 py-1.5 text-xs text-slate-300">
      <RepoIcon size={14} className="text-slate-400" />
      <span className="text-slate-400">Repository</span>
      <div className="relative min-w-[260px] max-w-[320px]">
        <SearchIcon size={12} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
        <input
          value={repoSearch}
          list="repo-options"
          onChange={(event) => setRepoSearch(event.target.value)}
          onKeyDown={(event) => {
            if (event.key !== 'Enter') {
              return;
            }
            autoApplyRepositoryQuery(repoSearch);
          }}
          placeholder="Type repository name..."
          className="w-full rounded-md border border-border bg-[#0d1117] py-1.5 pl-7 pr-7 text-xs text-slate-200 outline-none focus:border-[#2f81f7]"
        />
        {repoSearch ? (
          <button
            type="button"
            onClick={() => setRepoSearch('')}
            className="absolute right-1.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-200"
            aria-label="Clear repository search"
          >
            <XIcon size={12} />
          </button>
        ) : null}
        <datalist id="repo-options">
          {visibleRepositories.slice(0, 80).map((repo) => (
            <option key={repo} value={repo} />
          ))}
        </datalist>
      </div>
    </div>
  );
}

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

  const selectedRepo = useMemo(() => searchParams.get('repo') || 'all', [searchParams]);
  const selectedWindow = useMemo(() => searchParams.get('window') || '30d', [searchParams]);
  const selectedRepoValue = selectedRepo === 'all' ? '' : selectedRepo;

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
    <header className="relative z-20 flex min-h-[72px] w-full flex-col gap-3 border-b border-border bg-[#0d1117] px-4 py-3 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
      <div>
        <p className="text-xs text-slate-400">GitFlow Analytics</p>
        <h1 className="mt-1 text-xl font-semibold text-slate-100">{title}</h1>
      </div>

      <div className="flex flex-wrap items-center gap-2 sm:gap-3">
        <RepositorySearchControl
          key={selectedRepoValue || 'all'}
          selectedRepoValue={selectedRepoValue}
          repositories={repositories}
          onRepoChange={onRepoChange}
        />

        <div className="boneyard-bar flex items-center gap-2 px-2.5 py-1.5 text-xs text-slate-300">
          <span className="text-slate-400">Window</span>
          <select
            value={selectedWindow}
            onChange={(event) => onWindowChange(event.target.value)}
            className="rounded-md border border-border bg-[#0d1117] px-2 py-1 text-xs text-slate-100 outline-none focus:border-[#2f81f7]"
          >
            <option value="7d">7d</option>
            <option value="30d">30d</option>
            <option value="90d">90d</option>
            <option value="all">All</option>
          </select>
        </div>

        <div className="boneyard-bar hidden items-center gap-2 px-3 py-1.5 text-xs text-slate-300 sm:flex">
          <DotFillIcon size={12} className="text-slate-400" />
          Unified metrics view
        </div>

        <div className={`boneyard-bar flex items-center gap-2 px-3 py-1.5 text-xs font-medium ${isConnected ? 'text-[#3fb950]' : 'text-[#d29922]'}`}>
          <PulseIcon size={13} className={`${isConnected ? 'text-[#3fb950]' : 'text-[#d29922]'}`} />
          {isConnected ? 'Stream online' : 'Disconnected'}
        </div>

        {connectionError ? (
          <div className="boneyard-bar border-[#da3633] px-3 py-1.5 text-xs text-[#f85149]">
            {connectionError}
          </div>
        ) : null}

        {!isConnected && !connectionError ? (
          <div className="boneyard-bar px-3 py-1.5 text-xs text-slate-300">
            Waiting for websocket events
          </div>
        ) : null}
      </div>
    </header>
  );
}
