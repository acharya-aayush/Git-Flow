import type { PRStreamEvent } from '@gitflow/shared';

export function combineAndSortEvents(
  liveEvents: PRStreamEvent[],
  historyEvents: PRStreamEvent[]
): PRStreamEvent[] {
  const map = new Map<string, PRStreamEvent>();

  for (const event of [...liveEvents, ...historyEvents]) {
    const repo = event.repo.trim();
    const key = `${event.action}|${repo.toLowerCase()}|${event.number}|${event.timestamp}`;

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

export function filterEventsByRepo(events: PRStreamEvent[], repoFilter: string | null): PRStreamEvent[] {
  if (!repoFilter || repoFilter === 'all') {
    return events;
  }

  const normalized = repoFilter.trim().toLowerCase();
  return events.filter((event) => event.repo.trim().toLowerCase() === normalized);
}
