'use client';
import { Title, Text, Card } from '@tremor/react';
import { useGitFlowStore } from '@/lib/store';
import { RepoActivityCard } from '@/components/dashboard/RepoActivityCard';
import { Suspense, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { isRepoActivityEvent, type RepoActivityEvent } from '@gitflow/shared';
import { combineAndSortEvents, filterEventsByRepo } from '@/lib/live-events';

function PRsLiveContent() {
  const sentinelHealthUrl = process.env.NEXT_PUBLIC_SENTINEL_HEALTH_URL || 'http://localhost:3001/health';
  const wsUrl = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3001/ws';

  const liveActivities = useGitFlowStore((state) => state.liveActivities);
  const isConnected = useGitFlowStore((state) => state.isConnected);
  const connectionError = useGitFlowStore((state) => state.connectionError);
  const reconnectAttempts = useGitFlowStore((state) => state.reconnectAttempts);
  const lastMessageAt = useGitFlowStore((state) => state.lastMessageAt);
  const wsLogs = useGitFlowStore((state) => state.wsLogs);
  const searchParams = useSearchParams();
  const [healthStatus, setHealthStatus] = useState<'unknown' | 'ok' | 'down'>('unknown');
  const [healthMessage, setHealthMessage] = useState('not checked yet');
  const [historyEvents, setHistoryEvents] = useState<RepoActivityEvent[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);

  const repoFilter = searchParams.get('repo');
  const windowFilter = searchParams.get('window') || '30d';

  useEffect(() => {
    let active = true;
    const loadHistory = async () => {
      setHistoryLoading(true);
      setHistoryError(null);

      try {
        const params = new URLSearchParams();
        params.set('window', windowFilter);
        params.set('limit', '120');

        if (repoFilter && repoFilter !== 'all') {
          params.set('repo', repoFilter);
        }

        const response = await fetch(`/api/repo-activity?${params.toString()}`, {
          method: 'GET',
          cache: 'no-store',
        });

        if (!response.ok) {
          throw new Error(`history endpoint returned ${response.status}`);
        }

        const data = await response.json();
        if (!active) return;

        const incoming = Array.isArray(data.events)
          ? data.events.filter(isRepoActivityEvent)
          : [];
        setHistoryEvents(incoming);
      } catch (error) {
        if (!active) return;
        const msg = error instanceof Error ? error.message : 'failed to load event history';
        setHistoryError(msg);
        setHistoryEvents([]);
      } finally {
        if (active) {
          setHistoryLoading(false);
        }
      }
    };

    loadHistory();
    return () => {
      active = false;
    };
  }, [repoFilter, windowFilter]);

  const combinedEvents = useMemo(() => {
    return combineAndSortEvents(liveActivities, historyEvents);
  }, [historyEvents, liveActivities]);

  const visibleEvents = useMemo(() => {
    return filterEventsByRepo(combinedEvents, repoFilter);
  }, [combinedEvents, repoFilter]);

  useEffect(() => {
    let mounted = true;
    let timer: ReturnType<typeof setInterval> | null = null;

    const checkHealth = async () => {
      try {
        const response = await fetch(sentinelHealthUrl, { method: 'GET' });
        if (!mounted) return;
        if (!response.ok) {
          setHealthStatus('down');
          setHealthMessage(`http ${response.status}`);
          return;
        }
        setHealthStatus('ok');
        setHealthMessage('sentinel health endpoint reachable');
      } catch {
        if (!mounted) return;
        setHealthStatus('down');
        setHealthMessage('cannot reach sentinel health endpoint');
      }
    };

    checkHealth();
    timer = setInterval(checkHealth, 10000);

    return () => {
      mounted = false;
      if (timer) clearInterval(timer);
    };
  }, [sentinelHealthUrl]);

  return (
    <div className="space-y-5 py-2">
      <section className="panel">
        <div className="panel-body flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Realtime Stream</p>
            <Title className="mt-2 text-3xl font-semibold tracking-tight text-slate-100">Repository Activity Wall</Title>
            <Text className="mt-2 text-sm text-slate-300/85">Live stream of commits, pull requests, reviews, and issues from webhook events.</Text>
            <Text className="mt-2 inline-flex rounded-md border border-border bg-[#0d1117] px-2 py-1 text-xs text-slate-300">
              Scope: {repoFilter || 'All repositories'}
            </Text>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className={`rounded-full border px-4 py-2 text-xs font-medium ${isConnected ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300' : 'border-amber-500/35 bg-amber-500/10 text-amber-200'}`}>
              {isConnected ? 'Connected' : 'Disconnected'}
            </div>
            <div className="rounded-full border border-border bg-[#0d1117] px-4 py-2 text-xs font-medium text-slate-300">
              {visibleEvents.length} visible events
            </div>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-5 xl:grid-cols-12">
        <Card className="panel xl:col-span-4 border-none bg-transparent p-0">
          <div className="panel-header">
            <h3 className="text-sm font-semibold uppercase tracking-[0.12em] text-slate-100">Stream Diagnostics</h3>
          </div>
          <div className="panel-body space-y-3 text-sm">
            <div className="flex items-center justify-between border-b border-border/60 pb-2">
              <span className="text-slate-400">WebSocket URL</span>
              <span className="metric-mono text-slate-200">{wsUrl}</span>
            </div>
            <div className="flex items-center justify-between border-b border-border/60 pb-2">
              <span className="text-slate-400">Reconnect Attempts</span>
              <span className="metric-mono text-slate-200">{reconnectAttempts}</span>
            </div>
            <div className="flex items-center justify-between border-b border-border/60 pb-2">
              <span className="text-slate-400">Last Message</span>
              <span className="metric-mono text-slate-200">{lastMessageAt ? new Date(lastMessageAt).toLocaleTimeString() : 'none'}</span>
            </div>
            <div className="flex items-center justify-between border-b border-border/60 pb-2">
              <span className="text-slate-400">Sentinel Health</span>
              <span className={`metric-mono ${healthStatus === 'ok' ? 'text-emerald-300' : healthStatus === 'down' ? 'text-red-200' : 'text-slate-300'}`}>
                {healthStatus}
              </span>
            </div>
            <div className="flex items-center justify-between border-b border-border/60 pb-2">
              <span className="text-slate-400">History Sync</span>
              <span className={`metric-mono ${historyError ? 'text-red-200' : historyLoading ? 'text-amber-200' : 'text-emerald-300'}`}>
                {historyError ? 'error' : historyLoading ? 'loading' : 'ready'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Last Error</span>
              <span className="metric-mono text-red-200">{connectionError || 'none'}</span>
            </div>
            <div className="rounded-md border border-border bg-[#0d1117] px-2 py-1.5 text-xs text-slate-300">
              {historyError ? `history sync failed: ${historyError}` : healthMessage}
            </div>
            <div className="rounded-md border border-border bg-[#0d1117] px-2 py-1.5 text-xs text-slate-300">
              Live total: {liveActivities.length}
            </div>
          </div>
        </Card>

        <Card className="panel xl:col-span-8 border-none bg-transparent p-0">
          <div className="panel-header">
            <h3 className="text-sm font-semibold uppercase tracking-[0.12em] text-slate-100">Event Logs</h3>
          </div>
          <div className="panel-body max-h-[220px] overflow-y-auto">
            {wsLogs.length === 0 ? (
              <Text className="text-slate-400">No websocket logs yet.</Text>
            ) : (
              <ul className="space-y-1">
                {wsLogs.map((log, index) => (
                  <li key={`${log}-${index}`} className="metric-mono rounded-md border border-border/60 bg-[#0d1117] px-2.5 py-1.5 text-xs text-slate-300">
                    {log}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Card>
      </section>

      <section className="mx-auto w-full max-w-4xl space-y-3">
        {visibleEvents.length === 0 ? (
          <Card className="panel border-none bg-transparent p-0">
            <div className="panel-body py-10 text-center">
              <Text className="mb-4 text-slate-300">
                {repoFilter && repoFilter !== 'all'
                  ? `No events found yet for ${repoFilter} in ${windowFilter}.`
                    : 'No events found yet. Push commits, create PRs, or open issues to populate this feed.'}
              </Text>
              <div className="flex justify-center gap-2">
                <div className="h-2.5 w-2.5 animate-pulse rounded-full bg-cyan-300/70" />
                <div className="h-2.5 w-2.5 animate-pulse rounded-full bg-cyan-300/50 [animation-delay:120ms]" />
                <div className="h-2.5 w-2.5 animate-pulse rounded-full bg-cyan-300/35 [animation-delay:240ms]" />
              </div>
            </div>
          </Card>
        ) : (
          visibleEvents.map((event) => (
            <RepoActivityCard key={event.id} event={event} />
          ))
        )}
      </section>
    </div>
  );
}

export default function PRsLivePage() {
  return (
    <Suspense fallback={<div className="panel p-5 text-sm text-slate-300">Loading live stream...</div>}>
      <PRsLiveContent />
    </Suspense>
  );
}
