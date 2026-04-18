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
  if (kind === 'push') return { label: 'commit push', className: 'border-[#1f6feb]/40 bg-[#1f6feb]/16 text-[#79c0ff]' };
  if (kind === 'pull_request') return { label: 'pull request', className: 'border-[#8957e5]/40 bg-[#8957e5]/18 text-[#bc8cff]' };
  if (kind === 'pull_request_review') return { label: 'review', className: 'border-[#9e6a03]/40 bg-[#9e6a03]/18 text-[#d29922]' };
  return { label: 'issue', className: 'border-[#da3633]/45 bg-[#da3633]/20 text-[#f85149]' };
}

function kindToIcon(kind: RepoActivityEvent['kind']) {
  if (kind === 'push') return <GitBranchIcon size={14} className="text-[#79c0ff]" />;
  if (kind === 'pull_request') return <GitPullRequestIcon size={14} className="text-[#bc8cff]" />;
  if (kind === 'pull_request_review') return <CommentDiscussionIcon size={14} className="text-[#d29922]" />;
  return <IssueOpenedIcon size={14} className="text-[#f85149]" />;
}

export function RepoActivityCard({ event }: { event: RepoActivityEvent }) {
  const badge = kindToBadge(event.kind);

  return (
    <Card className="panel border-none bg-transparent p-0">
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

          <Text className="metric-mono whitespace-nowrap text-xs text-slate-400">
            {formatDistanceToNow(new Date(event.timestamp), { addSuffix: true })}
          </Text>
        </Flex>
      </div>
    </Card>
  );
}
