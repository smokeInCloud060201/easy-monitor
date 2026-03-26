import { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import type { HistogramBucket } from '../../lib/api';

interface LogHistogramProps {
  buckets: HistogramBucket[];
  onBrushChange?: (from: number, to: number) => void;
}

export function LogHistogram({ buckets }: LogHistogramProps) {
  const data = useMemo(() =>
    buckets.map(b => ({
      ...b,
      info_count: Math.max(0, b.count - b.error_count - b.warn_count),
      time: new Date(b.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }),
    })), [buckets]);

  if (data.length === 0) {
    return (
      <div className="h-[120px] bg-surface border border-border rounded-lg flex items-center justify-center text-text-muted text-sm">
        No histogram data
      </div>
    );
  }

  return (
    <div className="h-[120px] bg-surface border border-border rounded-lg px-2 pt-1 pb-0">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} barCategoryGap={1}>
          <XAxis
            dataKey="time"
            tick={{ fill: '#6b7280', fontSize: 10 }}
            axisLine={{ stroke: '#374151' }}
            tickLine={false}
            interval="preserveStartEnd"
          />
          <YAxis
            tick={{ fill: '#6b7280', fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            width={30}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#111827',
              border: '1px solid #374151',
              borderRadius: '8px',
              fontSize: '12px',
              color: '#e5e7eb',
            }}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            formatter={(value: any, name: any) => {
              const labels: Record<string, string> = {
                info_count: 'Info/Debug',
                warn_count: 'Warnings',
                error_count: 'Errors',
              };
              return [value, labels[name] || name];
            }}
            labelFormatter={(label) => `Time: ${label}`}
          />
          <Bar dataKey="info_count" stackId="a" fill="#22c55e" radius={[0, 0, 0, 0]} />
          <Bar dataKey="warn_count" stackId="a" fill="#f59e0b" radius={[0, 0, 0, 0]} />
          <Bar dataKey="error_count" stackId="a" fill="#ef4444" radius={[2, 2, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
