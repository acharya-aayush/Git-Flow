'use client';

import { Card, Title, AreaChart, Text } from '@tremor/react';
import type { LifecycleChartDatum } from '@gitflow/shared';

const DEFAULT_CHARTDATA: LifecycleChartDatum[] = [
  { date: 'Today', 'Avg Lifecycle': 0 }
];

export function PRLifecycleChart({ chartdata = DEFAULT_CHARTDATA }: { chartdata?: LifecycleChartDatum[] }) {
  const displayChartdata = chartdata.length ? chartdata : DEFAULT_CHARTDATA;
  const hasTrendData = displayChartdata.length > 1;

  return (
    <Card className="panel h-full border-none bg-transparent p-0">
      <div className="panel-header">
        <Title className="text-slate-100">Lifecycle Trend</Title>
        <Text className="mt-1 text-slate-400">Merged PR turnaround by day</Text>
      </div>

      <div className="panel-body">
      {hasTrendData ? (
        <AreaChart
          className="h-56"
          data={displayChartdata}
          index="date"
          categories={['Avg Lifecycle']}
          colors={['cyan']}
          valueFormatter={(number: number) => `${number} hrs`}
          noDataText="Awaiting Pull Request events..."
        />
      ) : (
        <div className="rounded-xl border border-border bg-muted/20 p-4">
          <Text className="text-slate-300/85">
            Not enough merged PR history yet to render a lifecycle trend.
          </Text>
        </div>
      )}
      </div>
    </Card>
  );
}
