import type { RepoActivityEvent } from '@gitflow/shared';

export function combineAndSortEvents(
  liveEvents: RepoActivityEvent[],
  historyEvents: RepoActivityEvent[]
): RepoActivityEvent[] {
  const map = new Map<string, RepoActivityEvent>();

  for (const event of [...liveEvents, ...historyEvents]) {
    const repo = event.repo.trim();
    const key = `${event.kind}|${event.action}|${repo.toLowerCase()}|${event.number || ''}|${event.sha || ''}|${event.timestamp}`;

    if (!map.has(key)) {
      map.set(key, {
        ...event,
        repo,
      });
    }
  }

  return Array.from(map.values()).sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );
}

export function filterEventsByRepo(events: RepoActivityEvent[], repoFilter: string | null): RepoActivityEvent[] {
  if (!repoFilter || repoFilter === 'all') {
    return events;
  }

  const normalized = repoFilter.trim().toLowerCase();
  return events.filter((event) => event.repo.trim().toLowerCase() === normalized);
}
