import { Card, Text, Flex, Badge, type Color } from '@tremor/react';
import { formatDistanceToNow } from 'date-fns';
import type { PRStreamEvent } from '@gitflow/shared';

export function PRLiveCard({ pr }: { pr: PRStreamEvent }) {
  const isNew = new Date().getTime() - new Date(pr.timestamp).getTime() < 5000;

  const badgeColor: Color = pr.action.includes('closed')
    ? 'rose'
    : pr.action.includes('review')
      ? 'amber'
      : 'cyan';

  return (
    <Card className={`panel border-none bg-transparent p-0 transition-all duration-500 ${isNew ? 'ring-2 ring-cyan-300/45' : ''}`}>
      <div className="panel-body">
      <Flex alignItems="center" justifyContent="between">
        <div className="min-w-0">
          <Flex alignItems="center" className="gap-2">
            <span className="truncate text-sm font-semibold text-slate-100">{pr.repo} {pr.number ? `#${pr.number}` : ''}</span>
            <Badge color={badgeColor} size="xs">
              {pr.action}
            </Badge>
          </Flex>
          <Text className="mt-1 text-xs text-slate-400">{pr.state || 'active'}</Text>
        </div>
        <Text className="metric-mono whitespace-nowrap text-xs text-cyan-100/75">
          {formatDistanceToNow(new Date(pr.timestamp), { addSuffix: true })}
        </Text>
      </Flex>
      </div>
    </Card>
  );
}
