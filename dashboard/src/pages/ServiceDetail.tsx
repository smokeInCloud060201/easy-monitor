import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Zap, AlertTriangle, Clock, Activity, Server, TrendingUp } from 'lucide-react';
import { AreaChart, Area, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import {
  fetchServiceSummary, fetchResourcesWithMetrics, fetchServiceErrors, fetchLatencyDistribution, fetchServiceDependencies, searchTraces,
  type ServiceSummary, type ResourceWithMetrics, type TraceSummary, type LatencyDistribution, type ServiceDependencies,
} from '../lib/api';
import { LatencyDistributionChart } from '../components/apm/LatencyDistribution';
import { ErrorsSection } from '../components/apm/ErrorsSection';
import { DependencyMiniMap } from '../components/apm/DependencyMiniMap';
import { EndpointsTable } from '../components/apm/EndpointsTable';

function formatTime(ts: number) {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

interface ErrorEntry { name: string; resource: string; count: number; last_seen: string; }

export default function ServiceDetail() {
  const { name } = useParams<{ name: string }>();
  const [summary, setSummary] = useState<ServiceSummary | null>(null);
  const [resources, setResources] = useState<ResourceWithMetrics[]>([]);
  const [traces, setTraces] = useState<TraceSummary[]>([]);
  const [errors, setErrors] = useState<ErrorEntry[]>([]);
  const [latencyDist, setLatencyDist] = useState<LatencyDistribution | null>(null);
  const [deps, setDeps] = useState<ServiceDependencies | null>(null);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState('1h');

  useEffect(() => {
    if (!name) return;
    setLoading(true);
    Promise.all([
      fetchServiceSummary(name, timeRange).catch(() => null),
      fetchResourcesWithMetrics(name).catch(() => []),
      searchTraces({ service: name, limit: 10 }).then(r => r.traces).catch(() => []),
      fetchServiceErrors(name).catch(() => ({ errors: [] })),
      fetchLatencyDistribution(name, timeRange),
      fetchServiceDependencies(name, timeRange),
    ]).then(([s, r, t, e, ld, d]) => {
      setSummary(s);
      setResources(r);
      setTraces(t);
      setErrors(e.errors || []);
      setLatencyDist(ld);
      setDeps(d);
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
  const isHealthy = errorRate < 5;

  const chartData = summary?.timeseries.map(p => ({
    time: formatTime(p.timestamp),
    requests: p.requests,
    errors: p.errors,
    avg: p.avg_duration,
    p95: p.p95_duration,
    p99: p.p99_duration,
  })) || [];

  const errorTimeseries = chartData.map(d => ({ time: d.time, errors: d.errors }));

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-6">
      {/* ─── HEADER ─── */}
      <div className="flex items-center gap-4">
        <Link to="/apm" className="p-2 hover:bg-white/5 rounded-lg text-gray-400 hover:text-white transition-colors">
          <ArrowLeft size={20} />
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <Server className="w-6 h-6 text-primary" />
            <h1 className="text-3xl font-extrabold tracking-tight">{name}</h1>
            <span className={`px-2.5 py-0.5 rounded text-xs font-bold border ${
              isHealthy
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                : 'bg-red-500/10 text-red-400 border-red-500/30'
            }`}>
              {isHealthy ? '● HEALTHY' : '● DEGRADED'}
            </span>
          </div>
        </div>
        <div className="flex gap-1 bg-surface/50 rounded-lg p-1 border border-white/10">
          {['15m', '1h', '6h', '24h'].map(t => (
            <button key={t} onClick={() => setTimeRange(t)}
              className={`px-3 py-1.5 text-xs rounded font-bold transition-all ${
                timeRange === t ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'text-gray-400 hover:text-white'
              }`}>
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* ─── SECTION 1: Service Health Overview ─── */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <MetricCard icon={<Zap size={14} />} label="Requests" value={summary?.total_requests.toFixed(0) || '0'} color="text-blue-400" />
        <MetricCard icon={<AlertTriangle size={14} />} label="Error Rate" value={`${errorRate.toFixed(1)}%`} color={isHealthy ? "text-emerald-400" : "text-red-400"} />
        <MetricCard icon={<Clock size={14} />} label="Avg Latency" value={`${(summary?.avg_duration_ms || 0).toFixed(1)}ms`} color="text-amber-400" />
        <MetricCard icon={<TrendingUp size={14} />} label="P95 Latency" value={`${(summary?.p95_duration_ms || 0).toFixed(1)}ms`} color="text-orange-400" />
        <MetricCard icon={<Activity size={14} />} label="P99 Latency" value={`${(summary?.p99_duration_ms || 0).toFixed(1)}ms`} color="text-red-400" />
      </div>

      {/* ─── SECTIONS 2 & 3: Latency + Requests/Errors (2-col) ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Latency */}
        <div className="space-y-4">
          <ChartPanel title="Latency Percentiles">
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="time" tick={{ fill: '#64748b', fontSize: 9 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#64748b', fontSize: 9 }} axisLine={false} tickLine={false} width={40} />
                <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 8, fontSize: 11 }} />
                <Line type="monotone" dataKey="avg" stroke="#6366f1" strokeWidth={2} dot={false} name="Avg" />
                <Line type="monotone" dataKey="p95" stroke="#f59e0b" strokeWidth={2} dot={false} name="P95" />
                <Line type="monotone" dataKey="p99" stroke="#ef4444" strokeWidth={1.5} dot={false} name="P99" strokeDasharray="4 2" />
              </LineChart>
            </ResponsiveContainer>
          </ChartPanel>

          {latencyDist && <LatencyDistributionChart data={latencyDist} />}
        </div>

        {/* Right: Requests & Errors */}
        <div className="space-y-4">
          <ChartPanel title="Request Rate">
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="reqGrad10" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="time" tick={{ fill: '#64748b', fontSize: 9 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#64748b', fontSize: 9 }} axisLine={false} tickLine={false} width={40} />
                <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 8, fontSize: 11 }} />
                <Area type="monotone" dataKey="requests" stroke="#6366f1" fill="url(#reqGrad10)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </ChartPanel>

          <ChartPanel title="Error Rate">
            <ResponsiveContainer width="100%" height={140}>
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="errGrad10" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="time" tick={{ fill: '#64748b', fontSize: 9 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#64748b', fontSize: 9 }} axisLine={false} tickLine={false} width={30} />
                <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 8, fontSize: 11 }} />
                <Area type="monotone" dataKey="errors" stroke="#ef4444" fill="url(#errGrad10)" strokeWidth={1.5} />
              </AreaChart>
            </ResponsiveContainer>
          </ChartPanel>
        </div>
      </div>

      {/* ─── SECTION 4: Error Tracking ─── */}
      <ErrorsSection
        errors={errors}
        timeseries={errorTimeseries}
        totalErrors={summary?.total_errors || 0}
        errorRate={errorRate}
        serviceName={name || ''}
      />

      {/* ─── SECTION 5: Endpoints / Resources ─── */}
      <EndpointsTable resources={resources} serviceName={name || ''} />

      {/* ─── SECTION 6: Dependencies ─── */}
      {deps && (
        <DependencyMiniMap
          data={deps}
          currentService={name || ''}
          healthStatus={isHealthy ? 'healthy' : 'degraded'}
        />
      )}

      {/* ─── SECTION 7: Recent Traces ─── */}
      <div className="glass-panel p-4 shadow-xl">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
            <Zap className="w-4 h-4 text-amber-400" /> Recent Traces
          </h3>
          <Link to={`/traces?service=${name}`} className="text-xs text-primary hover:underline">
            View all traces →
          </Link>
        </div>
        {traces.length === 0 ? (
          <p className="text-gray-500 text-center py-6 text-sm">No traces found.</p>
        ) : (
          <div className="space-y-1">
            {traces.map(t => {
              const maxDuration = Math.max(...traces.map(tr => tr.duration_ms), 1);
              return (
                <Link key={t.trace_id} to={`/traces/${t.trace_id}`}
                  className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-white/5 transition-colors group">
                  <span className={`w-2 h-2 rounded-full flex-shrink-0 ${t.error ? 'bg-red-500' : 'bg-emerald-500'}`} />
                  <span className="font-mono text-[10px] text-gray-500 w-24 truncate">{t.trace_id.slice(0, 12)}…</span>
                  <span className="text-gray-300 flex-1 truncate text-xs">{t.root_name}</span>
                  <span className="text-gray-600 text-[10px]">{t.span_count} spans</span>
                  <div className="w-20 flex items-center gap-1.5">
                    <div className="flex-1 h-1 bg-black/40 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${t.error ? 'bg-red-500' : 'bg-blue-500'}`}
                        style={{ width: `${(t.duration_ms / maxDuration) * 100}%` }}
                      />
                    </div>
                    <span className="font-mono text-[10px] text-amber-400 tabular-nums w-14 text-right">{t.duration_ms.toFixed(1)}ms</span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function MetricCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string; color: string }) {
  return (
    <div className="glass-panel p-3 shadow-lg">
      <div className={`flex items-center gap-1.5 mb-1 ${color}`}>
        {icon}
        <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">{label}</span>
      </div>
      <p className="text-xl font-bold font-mono">{value}</p>
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
