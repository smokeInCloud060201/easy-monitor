import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Activity, ChevronRight } from 'lucide-react';
import { AreaChart, Area, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { fetchResourceSummary, searchTraces, type ServiceSummary, type TraceSummary } from '../lib/api';

function formatTime(ts: number) {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export default function ResourceDetail() {
  const { name, resource } = useParams<{ name: string; resource: string }>();
  const navigate = useNavigate();
  const [summary, setSummary] = useState<ServiceSummary | null>(null);
  const [traces, setTraces] = useState<TraceSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState('1h');
  const decodedResource = resource ? decodeURIComponent(resource) : '';

  useEffect(() => {
    if (!name || !decodedResource) return;
    setLoading(true);
    Promise.all([
      fetchResourceSummary(name, decodedResource, timeRange).catch(() => null),
      searchTraces({ service: name, resource: decodedResource, limit: 20 }).then(r => r.traces).catch(() => []),
    ]).then(([s, t]) => {
      setSummary(s);
      setTraces(t);
      setLoading(false);
    });
  }, [name, decodedResource, timeRange]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

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
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-400 mb-6">
        <Link to="/apm" className="hover:text-white transition-colors">APM</Link>
        <ChevronRight className="w-3 h-3" />
        <Link to={`/apm/services/${name}`} className="hover:text-white transition-colors">{name}</Link>
        <ChevronRight className="w-3 h-3" />
        <span className="text-white font-semibold">{decodedResource}</span>
      </div>

      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <Link to={`/apm/services/${name}`} className="p-2 hover:bg-white/5 rounded-lg text-gray-400 hover:text-white transition-colors">
          <ArrowLeft size={20} />
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-extrabold tracking-tight">{decodedResource}</h1>
          <p className="text-gray-400 text-sm mt-1">Service: {name}</p>
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

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
        <StatCard label="Total Requests" value={(summary?.total_requests || 0).toFixed(0)} />
        <StatCard label="Error Rate" value={`${summary && summary.total_requests > 0 ? (summary.total_errors / summary.total_requests * 100).toFixed(1) : '0'}%`} 
          accent={summary && summary.total_requests > 0 && (summary.total_errors / summary.total_requests * 100) > 5 ? 'red' : 'green'} />
        <StatCard label="Avg Latency" value={`${(summary?.avg_duration_ms || 0).toFixed(1)}ms`} />
        <StatCard label="P95 Latency" value={`${(summary?.p95_duration_ms || 0).toFixed(1)}ms`} />
        <StatCard label="P99 Latency" value={`${(summary?.p99_duration_ms || 0).toFixed(1)}ms`} />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        <div className="glass-panel p-4 shadow-xl">
          <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-3">Request Rate</h3>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={chartData}>
              <defs><linearGradient id="rReqGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#6366f1" stopOpacity={0.4}/><stop offset="95%" stopColor="#6366f1" stopOpacity={0}/></linearGradient></defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="time" tick={{ fill: '#64748b', fontSize: 10 }} />
              <YAxis tick={{ fill: '#64748b', fontSize: 10 }} />
              <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 8 }} />
              <Area type="monotone" dataKey="requests" stroke="#6366f1" fill="url(#rReqGrad)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="glass-panel p-4 shadow-xl">
          <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-3">Error Rate</h3>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={chartData}>
              <defs><linearGradient id="rErrGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#ef4444" stopOpacity={0.4}/><stop offset="95%" stopColor="#ef4444" stopOpacity={0}/></linearGradient></defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="time" tick={{ fill: '#64748b', fontSize: 10 }} />
              <YAxis tick={{ fill: '#64748b', fontSize: 10 }} />
              <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 8 }} />
              <Area type="monotone" dataKey="errors" stroke="#ef4444" fill="url(#rErrGrad)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="glass-panel p-4 shadow-xl">
          <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-3">Latency (ms)</h3>
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
        </div>
      </div>

      {/* Trace Samples */}
      <div className="glass-panel p-6 shadow-xl">
        <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
          <Activity className="w-5 h-5 text-amber-400" /> Trace Samples
        </h2>
        {traces.length === 0 ? (
          <p className="text-gray-500 text-center py-8">No traces found for this resource.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-400 border-b border-white/10">
                  <th className="pb-3 font-semibold">Trace ID</th>
                  <th className="pb-3 font-semibold text-right">Duration</th>
                  <th className="pb-3 font-semibold text-right">Spans</th>
                  <th className="pb-3 font-semibold">Status</th>
                  <th className="pb-3 font-semibold">Time</th>
                </tr>
              </thead>
              <tbody>
                {traces.map(t => (
                  <tr key={t.trace_id}
                    onClick={() => navigate(`/traces/${t.trace_id}`)}
                    className="border-b border-white/5 hover:bg-white/5 cursor-pointer transition-colors">
                    <td className="py-3 font-mono text-xs text-gray-300">{t.trace_id.slice(0, 16)}...</td>
                    <td className="py-3 text-right font-mono text-amber-400">{t.duration_ms.toFixed(1)}ms</td>
                    <td className="py-3 text-right font-mono text-gray-400">{t.span_count}</td>
                    <td className="py-3">
                      <span className={`px-2 py-0.5 rounded text-xs font-bold ${t.error ? 'bg-red-500/20 text-red-400' : 'bg-emerald-500/20 text-emerald-400'}`}>
                        {t.error ? 'ERROR' : 'OK'}
                      </span>
                    </td>
                    <td className="py-3 text-gray-500 text-xs">{new Date(t.timestamp).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value, accent }: { label: string; value: string; accent?: 'red' | 'green' }) {
  const color = accent === 'red' ? 'text-red-400' : accent === 'green' ? 'text-emerald-400' : 'text-white';
  return (
    <div className="glass-panel p-4">
      <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">{label}</p>
      <p className={`text-xl font-bold font-mono ${color}`}>{value}</p>
    </div>
  );
}
