export type DashboardWindow = '7d' | '30d' | '90d' | 'all';

const WINDOW_TO_DAYS: Record<DashboardWindow, number | null> = {
  '7d': 7,
  '30d': 30,
  '90d': 90,
  all: null,
};

export function parseDashboardWindow(value: string | null | undefined): DashboardWindow {
  if (value === '7d' || value === '30d' || value === '90d' || value === 'all') {
    return value;
  }

  return '30d';
}

export function getWindowStart(selectedWindow: DashboardWindow, now = new Date()): Date | undefined {
  const days = WINDOW_TO_DAYS[selectedWindow];

  if (!days) {
    return undefined;
  }

  const start = new Date(now);
  start.setDate(start.getDate() - days);
  return start;
}

export function isValidRepoFullName(repo: string): boolean {
  return /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repo);
}
