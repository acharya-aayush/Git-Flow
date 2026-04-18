'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  AlertCircle,
  GitPullRequest,
  Activity,
  Flame,
  CircleHelp,
  Share2,
} from 'lucide-react';
import { FloPanda } from '../ui/FloPanda';

const navigation = [
  { name: 'Overview', href: '/', icon: LayoutDashboard },
  { name: 'Stability', href: '/stability', icon: Activity },
  { name: 'Heatmap', href: '/heatmap', icon: Flame },
  { name: 'Issues', href: '/issues', icon: CircleHelp },
  { name: 'Contributors', href: '/contributors', icon: Share2 },
  { name: 'Bottlenecks', href: '/bottlenecks', icon: AlertCircle },
  { name: 'Realtime Feed', href: '/prs', icon: GitPullRequest },
];

function classNames(...classes: string[]) {
  return classes.filter(Boolean).join(' ');
}

export function Sidebar() {
  const pathname = usePathname();

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
            return (
              <Link
                key={item.name}
                href={item.href}
                className={classNames(
                  isActive
                    ? 'bg-blue-500/15 text-blue-200 border border-blue-400/30'
                    : 'text-slate-300 hover:bg-white/5 hover:text-white border border-transparent',
                  'group flex items-center rounded-xl px-3 py-2.5 text-sm font-medium transition-all'
                )}
              >
                <item.icon
                  className={classNames(
                    isActive ? 'text-blue-200' : 'text-slate-400 group-hover:text-slate-100',
                    'mr-3 h-4 w-4 flex-shrink-0'
                  )}
                  aria-hidden="true"
                />
                {item.name}
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto rounded-xl border border-blue-400/20 bg-blue-500/5 p-3 text-xs text-slate-300">
          <p className="font-semibold uppercase tracking-wide text-blue-200">Live Scope</p>
          <p className="mt-1 leading-relaxed text-slate-400">Historical + real-time pull request telemetry across connected repositories.</p>
        </div>
      </div>
    </aside>
  );
}
