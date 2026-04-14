'use client';
import { Card, Title, Text } from '@tremor/react';
import type { MergeFrictionGrid } from '@gitflow/shared';

const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const hours = ['Morning', 'Afternoon', 'Evening'];

const getColor = (val: number) => {
  if (val === 0) return 'bg-slate-700/40 text-slate-400';
  if (val < 2) return 'bg-emerald-400/75 text-slate-950';
  if (val < 5) return 'bg-amber-300/80 text-slate-950';
  return 'bg-rose-400/85 text-slate-950';
};

export function MergeFrictionHeatmap({
  data = [
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0],
  ],
}: { data?: MergeFrictionGrid }) {
  return (
    <Card className="panel border-none bg-transparent p-0">
      <div className="panel-header">
        <Title className="text-slate-100">Merge Friction Heatmap</Title>
        <Text className="mt-1 text-slate-400">Average hours from PR creation to merge</Text>
      </div>

      <div className="panel-body">
        <div className="grid grid-cols-[70px_repeat(3,minmax(0,1fr))] gap-2">
          <div />
          {hours.map((hour) => (
            <div key={hour} className="text-center text-xs uppercase tracking-wide text-slate-400">
              {hour}
            </div>
          ))}

          {days.map((day, dayIdx) => (
            <div key={day} className="contents">
              <div className="flex items-center text-xs font-medium uppercase tracking-wide text-slate-300">
                {day}
              </div>
              {hours.map((_, hourIdx) => (
                <div
                  key={`${day}-${hourIdx}`}
                  className={`flex h-10 items-center justify-center rounded-lg text-xs font-bold ${getColor(data[dayIdx][hourIdx])}`}
                >
                  {data[dayIdx][hourIdx] > 0 ? `+${data[dayIdx][hourIdx]}h` : '--'}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}
