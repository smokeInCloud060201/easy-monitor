import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from 'recharts';
import type { SystemMetricPoint } from '../../lib/api';

interface Props {
  data: SystemMetricPoint[];
  loading?: boolean;
}

export function TimeSeriesChart({ data, loading }: Props) {
  if (loading) {
    return <div className="h-full w-full flex items-center justify-center text-gray-500">Loading metrics...</div>;
  }
  
  if (!data || data.length === 0) {
    return <div className="h-full w-full flex items-center justify-center text-gray-500">No data for selected time range</div>;
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
        <defs>
          <linearGradient id="colorCpu" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="colorRam" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
        <XAxis 
          dataKey="time" 
          stroke="#71717a" 
          tick={{ fill: '#71717a', fontSize: 12 }} 
          tickLine={false} 
          axisLine={false}
          minTickGap={20}
        />
        <YAxis 
          stroke="#71717a" 
          tick={{ fill: '#71717a', fontSize: 12 }} 
          tickLine={false} 
          axisLine={false} 
          domain={[0, 100]}
          tickFormatter={(val) => `${val}%`}
        />
        <Tooltip 
          contentStyle={{ backgroundColor: '#18181b', borderColor: '#27272a', color: '#f4f4f5' }}
          itemStyle={{ color: '#e4e4e7' }}
        />
        <Area 
          type="monotone" 
          dataKey="cpu" 
          name="CPU Usage"
          stroke="#3b82f6" 
          fillOpacity={1} 
          fill="url(#colorCpu)" 
          strokeWidth={2}
          isAnimationActive={false}
        />
        <Area 
          type="monotone" 
          dataKey="ram" 
          name="RAM Usage"
          stroke="#10b981" 
          fillOpacity={1} 
          fill="url(#colorRam)" 
          strokeWidth={2}
          isAnimationActive={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
