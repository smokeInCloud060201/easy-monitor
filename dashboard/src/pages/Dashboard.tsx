import { useEffect, useState } from 'react';
import { useTimeRange } from '../hooks/useTimeRange';
import { fetchMetrics, type SystemMetricPoint } from '../lib/api';
import { TimeSeriesChart } from '../components/metrics/TimeSeriesChart';

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
    <div className="flex-1 flex flex-col p-6 overflow-hidden">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-white tracking-tight">System Metrics</h1>
        <div className="flex items-center gap-2 bg-gray-900 border border-gray-800 rounded-lg px-4 py-2 text-sm text-gray-400">
          <span>Time Range:</span>
          <span className="text-gray-200 font-medium">{from}</span>
          <span>to</span>
          <span className="text-gray-200 font-medium">{to}</span>
        </div>
      </div>
      
      <div className="grid grid-cols-3 gap-6 mb-6">
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 shadow-sm">
          <div className="text-gray-400 text-sm font-medium mb-1">Active Nodes</div>
          <div className="text-3xl font-bold text-white">4</div>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 shadow-sm">
          <div className="text-gray-400 text-sm font-medium mb-1">Ingestion Rate</div>
          <div className="text-3xl font-bold text-white">12.4k/s</div>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 shadow-sm">
          <div className="text-gray-400 text-sm font-medium mb-1">System Health</div>
          <div className="text-3xl font-bold text-emerald-400">Excellent</div>
        </div>
      </div>

      <div className="flex-1 bg-gray-900 border border-gray-800 rounded-xl p-6 shadow-sm min-h-[300px]">
        <div className="mb-4 text-gray-100 font-semibold">Cluster Resource Utilization</div>
        <div className="h-[calc(100%-2rem)]">
          <TimeSeriesChart data={data} loading={loading} />
        </div>
      </div>
    </div>
  );
}
