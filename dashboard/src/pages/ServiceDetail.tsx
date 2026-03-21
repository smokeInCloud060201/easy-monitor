import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Activity, AlertTriangle, Clock, Zap, Server, ChevronRight } from 'lucide-react';
import { AreaChart, Area, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import {
  fetchServiceSummary, fetchResourcesWithMetrics, searchTraces,
  type ServiceSummary, type ResourceWithMetrics, type TraceSummary
} from '../lib/api';

function formatTime(ts: number) {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export default function ServiceDetail() {
  const { name } = useParams<{ name: string }>();
  const navigate = useNavigate();
  const [summary, setSummary] = useState<ServiceSummary | null>(null);
  const [resources, setResources] = useState<ResourceWithMetrics[]>([]);
  const [traces, setTraces] = useState<TraceSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState('1h');

  useEffect(() => {
    if (!name) return;
    setLoading(true);
    Promise.all([
      fetchServiceSummary(name, timeRange).catch(() => null),
      fetchResourcesWithMetrics(name).catch(() => []),
      searchTraces({ service: name, limit: 10 }).then(r => r.traces).catch(() => []),
    ]).then(([s, r, t]) => {
      setSummary(s);
      setResources(r);
      setTraces(t);
      setLoading(false);
    });
  }, [name, timeRange]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const errorRate = summary && summary.total_requests > 0 
    ? (summary.total_errors / summary.total_requests * 100) 
    : 0;

  const chartData = summary?.timeseries.map(p => ({
    time: formatTime(p.timestamp),
    requests: p.requests,
    errors: p.errors,
    avg: p.avg_duration,
    p95: p.p95_duration,
    p99: p.p99_duration,
  })) || [];

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <Link to="/apm" className="p-2 hover:bg-white/5 rounded-lg text-gray-400 hover:text-white transition-colors">
          <ArrowLeft size={20} />
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <Server className="w-6 h-6 text-primary" />
            <h1 className="text-3xl font-extrabold tracking-tight">{name}</h1>
            <span className={`px-2 py-0.5 rounded text-xs font-bold ${errorRate < 5 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
              {errorRate < 5 ? 'HEALTHY' : 'DEGRADED'}
            </span>
          </div>
        </div>
        <div className="flex gap-1 bg-surface/50 rounded-lg p-1 border border-white/10">
          {['1h', '6h', '24h'].map(t => (
            <button key={t} onClick={() => setTimeRange(t)}
              className={`px-3 py-1 text-xs rounded font-bold transition-all ${timeRange === t ? 'bg-primary text-white' : 'text-gray-400 hover:text-white'}`}>
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <MetricCard icon={<Zap />} label="Requests" value={summary?.total_requests.toFixed(0) || '0'} color="text-blue-400" />
        <MetricCard icon={<AlertTriangle />} label="Error Rate" value={`${errorRate.toFixed(1)}%`} color={errorRate < 5 ? "text-emerald-400" : "text-red-400"} />
        <MetricCard icon={<Clock />} label="Avg Latency" value={`${(summary?.avg_duration_ms || 0).toFixed(1)}ms`} color="text-amber-400" />
        <MetricCard icon={<Activity />} label="P95 Latency" value={`${(summary?.p95_duration_ms || 0).toFixed(1)}ms`} color="text-orange-400" />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        <ChartPanel title="Request Rate">
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={chartData}>
              <defs><linearGradient id="reqGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#6366f1" stopOpacity={0.4}/><stop offset="95%" stopColor="#6366f1" stopOpacity={0}/></linearGradient></defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="time" tick={{ fill: '#64748b', fontSize: 10 }} />
              <YAxis tick={{ fill: '#64748b', fontSize: 10 }} />
              <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 8 }} />
              <Area type="monotone" dataKey="requests" stroke="#6366f1" fill="url(#reqGrad)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </ChartPanel>

        <ChartPanel title="Error Rate">
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={chartData}>
              <defs><linearGradient id="errGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#ef4444" stopOpacity={0.4}/><stop offset="95%" stopColor="#ef4444" stopOpacity={0}/></linearGradient></defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="time" tick={{ fill: '#64748b', fontSize: 10 }} />
              <YAxis tick={{ fill: '#64748b', fontSize: 10 }} />
              <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 8 }} />
              <Area type="monotone" dataKey="errors" stroke="#ef4444" fill="url(#errGrad)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </ChartPanel>

        <ChartPanel title="Latency (ms)">
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="time" tick={{ fill: '#64748b', fontSize: 10 }} />
              <YAxis tick={{ fill: '#64748b', fontSize: 10 }} />
              <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 8 }} />
              <Line type="monotone" dataKey="avg" stroke="#6366f1" strokeWidth={2} dot={false} name="Avg" />
              <Line type="monotone" dataKey="p95" stroke="#f59e0b" strokeWidth={2} dot={false} name="P95" />
              <Line type="monotone" dataKey="p99" stroke="#ef4444" strokeWidth={2} dot={false} name="P99" />
            </LineChart>
          </ResponsiveContainer>
        </ChartPanel>
      </div>

      {/* Resources Table */}
      <div className="glass-panel p-6 mb-8 shadow-xl">
        <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
          <Activity className="w-5 h-5 text-primary" /> Resources
        </h2>
        {resources.length === 0 ? (
          <p className="text-gray-500 text-center py-8">No resource data available yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-400 border-b border-white/10">
                  <th className="pb-3 font-semibold">Resource</th>
                  <th className="pb-3 font-semibold text-right">Requests</th>
                  <th className="pb-3 font-semibold text-right">Errors</th>
                  <th className="pb-3 font-semibold text-right">Error Rate</th>
                  <th className="pb-3 font-semibold text-right">Avg Latency</th>
                  <th className="pb-3 font-semibold text-right">P95</th>
                  <th className="pb-3 w-8"></th>
                </tr>
              </thead>
              <tbody>
                {resources.map((r) => (
                  <tr key={r.resource}
                    onClick={() => navigate(`/apm/services/${name}/resources/${encodeURIComponent(r.resource)}`)}
                    className="border-b border-white/5 hover:bg-white/5 cursor-pointer transition-colors group">
                    <td className="py-3 font-mono text-gray-200 group-hover:text-primary transition-colors">{r.resource}</td>
                    <td className="py-3 text-right font-mono">{r.requests.toFixed(0)}</td>
                    <td className="py-3 text-right font-mono text-red-400">{r.errors.toFixed(0)}</td>
                    <td className="py-3 text-right">
                      <span className={`px-2 py-0.5 rounded text-xs font-bold ${r.error_rate < 5 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
                        {r.error_rate.toFixed(1)}%
                      </span>
                    </td>
                    <td className="py-3 text-right font-mono">{r.avg_duration_ms.toFixed(1)}ms</td>
                    <td className="py-3 text-right font-mono text-amber-400">{r.p95_duration_ms.toFixed(1)}ms</td>
                    <td className="py-3"><ChevronRight className="w-4 h-4 text-gray-600 group-hover:text-primary transition-colors" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Recent Traces */}
      <div className="glass-panel p-6 shadow-xl">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Zap className="w-5 h-5 text-amber-400" /> Recent Traces
          </h2>
          <Link to={`/traces?service=${name}`} className="text-sm text-primary hover:underline">
            View all traces →
          </Link>
        </div>
        {traces.length === 0 ? (
          <p className="text-gray-500 text-center py-8">No traces found.</p>
        ) : (
          <div className="space-y-2">
            {traces.map(t => (
              <Link key={t.trace_id} to={`/traces/${t.trace_id}`}
                className="flex items-center gap-4 p-3 rounded-lg hover:bg-white/5 transition-colors group">
                <span className={`w-2 h-2 rounded-full ${t.error ? 'bg-red-500' : 'bg-emerald-500'}`} />
                <span className="font-mono text-xs text-gray-400 w-28 truncate">{t.trace_id.slice(0, 12)}...</span>
                <span className="text-gray-300 flex-1 truncate">{t.root_name}</span>
                <span className="text-gray-500 text-xs">{t.span_count} spans</span>
                <span className="font-mono text-sm text-amber-400 bg-black/40 px-2 py-0.5 rounded">{t.duration_ms.toFixed(1)}ms</span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function MetricCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string; color: string }) {
  return (
    <div className="glass-panel p-4 shadow-lg">
      <div className={`flex items-center gap-2 mb-2 ${color}`}>
        <span className="w-4 h-4">{icon}</span>
        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{label}</span>
      </div>
      <p className="text-2xl font-bold font-mono">{value}</p>
    </div>
  );
}

function ChartPanel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="glass-panel p-4 shadow-xl">
      <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-3">{title}</h3>
      {children}
    </div>
  );
}
