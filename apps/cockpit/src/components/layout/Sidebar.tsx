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
    <aside className="hidden h-full w-[270px] shrink-0 border-r border-border bg-[#0d1117] lg:flex lg:flex-col">
      <div className="border-b border-border/70 px-5 py-5">
        <FloPanda className="mb-3" />
        <p className="text-xs text-slate-400">Engineering control room</p>
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
                    ? 'border border-border bg-[#21262d] text-[#f0f6fc]'
                    : 'border border-transparent text-slate-300 hover:border-border hover:bg-[#161b22] hover:text-[#f0f6fc]',
                  'group flex items-center rounded-sm px-3 py-2.5 text-sm font-medium transition-all'
                )}
              >
                <item.icon
                  size={14}
                  className={classNames(
                    isActive ? 'text-[#f0f6fc]' : 'text-slate-400 group-hover:text-slate-200',
                    'mr-3 flex-shrink-0'
                  )}
                  aria-hidden="true"
                />
                {item.name}
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto rounded-md border border-border bg-[#161b22] p-3 text-xs text-slate-300">
          <p className="font-semibold text-slate-200">Live scope</p>
          <p className="mt-1 leading-relaxed text-slate-400">Historical and real-time pull request telemetry across connected repositories.</p>
        </div>
      </div>
    </aside>
  );
}
