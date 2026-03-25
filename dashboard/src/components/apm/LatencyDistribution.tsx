import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import type { LatencyDistribution } from '../../lib/api';

const barColors = ['#22c55e', '#4ade80', '#a3e635', '#facc15', '#f59e0b', '#ef4444', '#dc2626'];

interface LatencyDistributionChartProps {
  data: LatencyDistribution;
}

export function LatencyDistributionChart({ data }: LatencyDistributionChartProps) {
  if (!data.buckets.length) {
    return (
      <div className="glass-panel p-6">
        <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-3">Latency Distribution</h3>
        <div className="h-[160px] flex items-center justify-center text-gray-500 text-sm">No latency data</div>
      </div>
    );
  }

  const chartData = data.buckets.map(b => ({
    name: b.range_label,
    count: b.count,
    percentage: b.percentage,
  }));

  return (
    <div className="glass-panel p-4 shadow-xl">
      <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-3">Latency Distribution</h3>
      
      <ResponsiveContainer width="100%" height={160}>
        <BarChart data={chartData} barCategoryGap="15%">
          <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 9 }} axisLine={{ stroke: '#1e293b' }} tickLine={false} />
          <YAxis tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} width={40} />
          <Tooltip
            contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 8, fontSize: 12 }}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            formatter={(value: number, _name: string, props: any) => [
              `${value.toLocaleString()} (${props.payload.percentage.toFixed(1)}%)`,
              'Requests'
            ]}
          />
          <Bar dataKey="count" radius={[4, 4, 0, 0]}>
            {chartData.map((_entry, i) => (
              <Cell key={i} fill={barColors[i % barColors.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      {/* Percentile Pills */}
      <div className="flex items-center gap-3 mt-3 pt-3 border-t border-white/10">
        <PercentilePill label="P50" value={data.p50_ms} color="text-green-400" />
        <PercentilePill label="P90" value={data.p90_ms} color="text-yellow-400" />
        <PercentilePill label="P95" value={data.p95_ms} color="text-orange-400" />
        <PercentilePill label="P99" value={data.p99_ms} color="text-red-400" />
        <span className="ml-auto text-[10px] text-gray-600">{data.total_requests.toLocaleString()} total</span>
      </div>
    </div>
  );
}

function PercentilePill({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex items-center gap-1.5 bg-white/5 rounded-lg px-2.5 py-1">
      <span className="text-[10px] text-gray-500 font-semibold">{label}</span>
      <span className={`text-xs font-bold font-mono ${color}`}>{value.toFixed(1)}ms</span>
    </div>
  );
}
