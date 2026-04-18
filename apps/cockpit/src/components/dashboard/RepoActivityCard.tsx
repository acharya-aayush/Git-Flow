import { Card, Text, Flex } from '@tremor/react';
import { formatDistanceToNow } from 'date-fns';
import {
  CommentDiscussionIcon,
  GitBranchIcon,
  GitPullRequestIcon,
  IssueOpenedIcon,
} from '@primer/octicons-react';
import type { RepoActivityEvent } from '@gitflow/shared';

function kindToBadge(kind: RepoActivityEvent['kind']): { label: string; className: string } {
  if (kind === 'push') return { label: 'commit push', className: 'border-cyan-300/35 bg-cyan-300/10 text-cyan-100' };
  if (kind === 'pull_request') return { label: 'pull request', className: 'border-indigo-300/35 bg-indigo-300/10 text-indigo-100' };
  if (kind === 'pull_request_review') return { label: 'review', className: 'border-amber-300/35 bg-amber-300/10 text-amber-100' };
  return { label: 'issue', className: 'border-rose-300/35 bg-rose-300/10 text-rose-100' };
}

function kindToIcon(kind: RepoActivityEvent['kind']) {
  if (kind === 'push') return <GitBranchIcon size={14} className="text-cyan-200" />;
  if (kind === 'pull_request') return <GitPullRequestIcon size={14} className="text-indigo-200" />;
  if (kind === 'pull_request_review') return <CommentDiscussionIcon size={14} className="text-amber-200" />;
  return <IssueOpenedIcon size={14} className="text-rose-200" />;
}

export function RepoActivityCard({ event }: { event: RepoActivityEvent }) {
  const badge = kindToBadge(event.kind);

  return (
    <Card className="panel border-none bg-transparent p-0 transition-all duration-300 hover:translate-y-[-1px]">
      <div className="panel-body">
        <Flex alignItems="center" justifyContent="between">
          <div className="min-w-0">
            <Flex alignItems="center" className="gap-2">
              {kindToIcon(event.kind)}
              <span className="truncate text-sm font-semibold text-slate-100">{event.repo}</span>
              <span className={`inline-flex rounded-sm border px-2 py-0.5 text-[10px] uppercase tracking-[0.08em] ${badge.className}`}>
                {badge.label}
              </span>
            </Flex>

            <Text className="mt-1 text-xs text-slate-300/90">
              {event.number ? `#${event.number}` : event.sha ? event.sha.slice(0, 7) : event.action}
              {event.title ? ` · ${event.title}` : ''}
              {event.message ? ` · ${event.message}` : ''}
            </Text>

            <Text className="mt-1 text-[11px] text-slate-400">
              {event.actor ? `by ${event.actor}` : 'actor unknown'}
              {event.state ? ` · ${event.state}` : ''}
              {` · ${event.action}`}
            </Text>
          </div>

          <Text className="metric-mono whitespace-nowrap text-xs text-cyan-100/75">
            {formatDistanceToNow(new Date(event.timestamp), { addSuffix: true })}
          </Text>
        </Flex>
      </div>
    </Card>
  );
}
