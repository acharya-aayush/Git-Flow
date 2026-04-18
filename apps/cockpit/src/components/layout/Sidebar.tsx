'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import {
  AlertIcon,
  FlameIcon,
  GitPullRequestIcon,
  HomeIcon,
  PeopleIcon,
  PulseIcon,
  QuestionIcon,
} from '@primer/octicons-react';
import { FloPanda } from '../ui/FloPanda';

const navigation = [
  { name: 'Overview', href: '/', icon: HomeIcon },
  { name: 'Stability', href: '/stability', icon: PulseIcon },
  { name: 'Heatmap', href: '/heatmap', icon: FlameIcon },
  { name: 'Issues', href: '/issues', icon: QuestionIcon },
  { name: 'Contributors', href: '/contributors', icon: PeopleIcon },
  { name: 'Bottlenecks', href: '/bottlenecks', icon: AlertIcon },
  { name: 'Realtime Feed', href: '/prs', icon: GitPullRequestIcon },
];

function classNames(...classes: string[]) {
  return classes.filter(Boolean).join(' ');
}

export function Sidebar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const activeQuery = searchParams.toString();

  return (
    <aside className="hidden h-full w-[270px] shrink-0 border-r border-border/80 bg-[#161b22]/95 lg:flex lg:flex-col">
      <div className="border-b border-border/70 px-5 py-5">
        <FloPanda className="mb-3" />
        <p className="text-[11px] uppercase tracking-[0.24em] text-slate-400">Engineering Control Room</p>
      </div>

      <div className="flex flex-1 flex-col overflow-y-auto px-4 py-5">
        <nav className="space-y-2">
          {navigation.map((item) => {
            const isActive = pathname === item.href;
            const hrefWithQuery = activeQuery ? `${item.href}?${activeQuery}` : item.href;
            return (
              <Link
                key={item.name}
                href={hrefWithQuery}
                className={classNames(
                  isActive
                    ? 'bg-blue-500/15 text-blue-200 border border-blue-400/30'
                    : 'text-slate-300 hover:bg-white/5 hover:text-white border border-transparent',
                  'group flex items-center rounded-sm px-3 py-2.5 text-sm font-medium transition-all'
                )}
              >
                <item.icon
                  size={14}
                  className={classNames(
                    isActive ? 'text-blue-200' : 'text-slate-400 group-hover:text-slate-100',
                    'mr-3 flex-shrink-0'
                  )}
                  aria-hidden="true"
                />
                {item.name}
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto rounded-sm border border-blue-400/20 bg-blue-500/5 p-3 text-xs text-slate-300">
          <p className="font-semibold uppercase tracking-wide text-blue-200">Live Scope</p>
          <p className="mt-1 leading-relaxed text-slate-400">Historical + real-time pull request telemetry across connected repositories.</p>
        </div>
      </div>
    </aside>
  );
}
