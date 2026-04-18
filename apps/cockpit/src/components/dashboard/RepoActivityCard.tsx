import { Card, Text, Flex, Badge, type Color } from '@tremor/react';
import { formatDistanceToNow } from 'date-fns';
import { GitBranch, GitPullRequest, MessageSquareMore, CircleAlert } from 'lucide-react';
import type { RepoActivityEvent } from '@gitflow/shared';

function kindToBadge(kind: RepoActivityEvent['kind']): { color: Color; label: string } {
  if (kind === 'push') return { color: 'cyan', label: 'commit push' };
  if (kind === 'pull_request') return { color: 'indigo', label: 'pull request' };
  if (kind === 'pull_request_review') return { color: 'amber', label: 'review' };
  return { color: 'rose', label: 'issue' };
}

function kindToIcon(kind: RepoActivityEvent['kind']) {
  if (kind === 'push') return <GitBranch className="h-4 w-4 text-cyan-200" />;
  if (kind === 'pull_request') return <GitPullRequest className="h-4 w-4 text-indigo-200" />;
  if (kind === 'pull_request_review') return <MessageSquareMore className="h-4 w-4 text-amber-200" />;
  return <CircleAlert className="h-4 w-4 text-rose-200" />;
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
              <Badge color={badge.color} size="xs">
                {badge.label}
              </Badge>
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
