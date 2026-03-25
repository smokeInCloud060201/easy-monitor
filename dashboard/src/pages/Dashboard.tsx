import { useEffect, useState } from 'react';
import { useTimeRange } from '../hooks/useTimeRange';
import { fetchMetrics, type SystemMetricPoint } from '../lib/api';
import { TimeSeriesChart } from '../components/metrics/TimeSeriesChart';
import { Activity, Cpu, TrendingUp } from 'lucide-react';

export function Dashboard() {
  const { from, to } = useTimeRange();
  const [data, setData] = useState<SystemMetricPoint[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);

    fetchMetrics(from, to).then(result => {
      if (active) {
        setData(result);
        setLoading(false);
      }
    });

    return () => { active = false; };
  }, [from, to]);

  return (
    <div className="page-container">
      <div className="flex items-center justify-between mb-6">
        <h1 className="page-title">System Metrics</h1>
        <div className="flex items-center gap-2 glass-panel px-4 py-2 text-[13px] text-gray-400">
          <span>Time Range:</span>
          <span className="text-gray-200 font-medium">{from}</span>
          <span>to</span>
          <span className="text-gray-200 font-medium">{to}</span>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6">
        <MetricCard icon={<Cpu size={16} />} label="Active Nodes" value="4" accent="text-brand-light" />
        <MetricCard icon={<TrendingUp size={16} />} label="Ingestion Rate" value="12.4k/s" accent="text-brand-light" />
        <MetricCard icon={<Activity size={16} />} label="System Health" value="Excellent" accent="text-success" />
      </div>

      <div className="flex-1 glass-panel p-4 min-h-[300px]">
        <div className="section-title mb-3">Cluster Resource Utilization</div>
        <div className="h-[calc(100%-2rem)]">
          <TimeSeriesChart data={data} loading={loading} />
        </div>
      </div>
    </div>
  );
}

function MetricCard({ icon, label, value, accent }: { icon: React.ReactNode; label: string; value: string; accent: string }) {
  return (
    <div className="glass-panel-hover p-4">
      <div className="flex items-center gap-2 mb-2">
        <span className={accent}>{icon}</span>
        <span className="text-gray-500 text-[11px] font-medium uppercase tracking-wider">{label}</span>
      </div>
      <div className={`text-2xl font-bold font-mono tabular-nums ${accent}`}>{value}</div>
    </div>
  );
}
export default Dashboard;
