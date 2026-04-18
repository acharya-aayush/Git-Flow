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
            colors={['blue']}
            yAxisWidth={42}
            noDataText="Awaiting pull request review events..."
          />
        ) : (
          <div className="rounded-md border border-border bg-[#0d1117] p-4">
            <Text className="text-slate-300/85">No review events found yet.</Text>
          </div>
        )}
      </div>
    </Card>
  );
}
