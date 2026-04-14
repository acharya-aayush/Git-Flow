'use client';
import { Card, Title, BarChart, Text } from '@tremor/react';
import type { ReviewsBarDatum } from '@gitflow/shared';

export function ReviewsBarChart({ chartdata = [] }: { chartdata?: ReviewsBarDatum[] }) {
  return (
    <Card className="panel border-none bg-transparent p-0">
      <div className="panel-header">
        <Title className="text-slate-100">Reviewer Load</Title>
        <Text className="mt-1 text-slate-400">Who is carrying review volume</Text>
      </div>

      <div className="panel-body">
        {chartdata.length > 0 ? (
          <BarChart
            className="h-56"
            data={chartdata}
            index="name"
            categories={['Reviews']}
            colors={['cyan']}
            yAxisWidth={42}
            noDataText="Awaiting pull request review events..."
          />
        ) : (
          <div className="rounded-xl border border-border bg-muted/20 p-4">
            <Text className="text-slate-300/85">No review events found yet.</Text>
          </div>
        )}
      </div>
    </Card>
  );
}
