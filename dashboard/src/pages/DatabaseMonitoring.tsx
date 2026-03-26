import { useEffect, useState, useCallback, memo } from 'react';
import { Link } from 'react-router-dom';
import { Database, Loader2, Clock, AlertTriangle, Server, ArrowUpDown, ChevronRight, Search, Zap } from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000';

function getAuthHeaders(): Record<string, string> {
  const token = localStorage.getItem('auth_token');
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return headers;
}

async function apiFetch(url: string) {
  const res = await fetch(`${API_BASE}${url}`, { headers: getAuthHeaders() });
  if (res.status === 401) { localStorage.removeItem('auth_token'); window.location.href = '/login'; }
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

// ─── Types ───

interface DatabaseInfo {
  db_type: string;
  display_name: string;
  icon: string;
  total_queries: number;
  error_count: number;
  error_rate: number;
  avg_latency_ms: number;
  p95_latency_ms: number;
  service_count: number;
}

interface DbQueryInfo {
  resource: string;
  frequency: number;
  avg_latency_ms: number;
  p95_latency_ms: number;
  max_latency_ms: number;
  error_count: number;
  error_rate: number;
  services: string[];
}

interface SlowQueryInfo {
  resource: string;
  service: string;
  duration_ms: number;
  timestamp: string;
  timestamp_ms: number;
  trace_id: string;
  error: boolean;
}

interface DbServiceInfo {
  service: string;
  query_count: number;
  error_count: number;
  error_rate: number;
  avg_latency_ms: number;
  p95_latency_ms: number;
}

interface DbTimePoint {
  timestamp: number;
  query_count: number;
  error_count: number;
  avg_latency_ms: number;
  p95_latency_ms: number;
}

// ─── Database Logos ───

import postgresqlLogo from '../assets/postgresql-logo-svgrepo-com.svg';
import redisLogo from '../assets/redis-svgrepo-com.svg';

function DbLogo({ dbType, size = 28 }: { dbType: string; size?: number }) {
  switch (dbType) {
    case 'postgresql': return <img src={postgresqlLogo} alt="PostgreSQL" width={size} height={size} />;
    case 'redis': return <img src={redisLogo} alt="Redis" width={size} height={size} />;
    default: return <Database size={size} className="text-text-secondary" />;
  }
}

// ─── Database Overview Cards ───

const DatabaseCard = memo(function DatabaseCard({ db, onClick, isSelected }: { db: DatabaseInfo; onClick: () => void; isSelected: boolean }) {
  const isHealthy = db.error_rate < 5;

  return (
    <div
      onClick={onClick}
      className={`glass-panel-hover p-5 cursor-pointer group relative overflow-hidden transition-all ${
        isSelected ? 'ring-2 ring-brand/50 bg-brand/5' : ''
      }`}
    >
      <div className={`absolute top-0 left-0 w-full h-1 ${isHealthy ? 'bg-success' : 'bg-danger'}`} />

      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <DbLogo dbType={db.db_type} />
          <div>
            <h3 className="text-sm font-bold text-text-primary">{db.display_name}</h3>
            <p className="text-[11px] text-text-muted">{db.service_count} service{db.service_count !== 1 ? 's' : ''}</p>
          </div>
        </div>
        <ChevronRight className={`w-4 h-4 transition-colors ${isSelected ? 'text-brand-light' : 'text-text-muted group-hover:text-brand-light'}`} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <p className="text-text-muted text-[10px] uppercase tracking-wider mb-0.5">Queries</p>
          <p className="text-base font-mono tabular-nums text-text-primary">{formatNumber(db.total_queries)}</p>
        </div>
        <div>
          <p className="text-text-muted text-[10px] uppercase tracking-wider mb-0.5">Avg Latency</p>
          <p className="text-base font-mono tabular-nums text-text-primary">{db.avg_latency_ms.toFixed(2)} ms</p>
        </div>
        <div>
          <p className="text-text-muted text-[10px] uppercase tracking-wider mb-0.5">P95 Latency</p>
          <p className="text-base font-mono tabular-nums text-text-primary">{db.p95_latency_ms.toFixed(2)} ms</p>
        </div>
        <div>
          <p className="text-text-muted text-[10px] uppercase tracking-wider mb-0.5">Error Rate</p>
          <p className={`text-base font-mono tabular-nums ${db.error_rate > 5 ? 'text-danger' : db.error_rate > 1 ? 'text-warning' : 'text-success'}`}>
            {db.error_rate.toFixed(1)}%
          </p>
        </div>
      </div>
    </div>
  );
});

// ─── Timeseries Mini Chart (Canvas) ───

const MiniChart = memo(function MiniChart({ data, dataKey, color, label }: { data: DbTimePoint[]; dataKey: keyof DbTimePoint; color: string; label: string }) {
  const canvasRef = useCallback((canvas: HTMLCanvasElement | null) => {
    if (!canvas || data.length < 2) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, w, h);

    const values = data.map(d => Number(d[dataKey]));
    const max = Math.max(...values, 1);
    const pad = 2;

    // Fill area
    ctx.beginPath();
    ctx.moveTo(pad, h);
    values.forEach((v, i) => {
      const x = pad + (i / (values.length - 1)) * (w - 2 * pad);
      const y = h - pad - (v / max) * (h - 2 * pad);
      ctx.lineTo(x, y);
    });
    ctx.lineTo(w - pad, h);
    ctx.closePath();
    ctx.fillStyle = color + '15';
    ctx.fill();

    // Line
    ctx.beginPath();
    values.forEach((v, i) => {
      const x = pad + (i / (values.length - 1)) * (w - 2 * pad);
      const y = h - pad - (v / max) * (h - 2 * pad);
      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }, [data, dataKey, color]);

  const latestVal = data.length > 0 ? Number(data[data.length - 1][dataKey]) : 0;

  return (
    <div className="glass-panel p-4">
      <div className="flex justify-between items-baseline mb-2">
        <p className="text-text-muted text-[11px] uppercase tracking-wider">{label}</p>
        <p className="text-sm font-mono tabular-nums text-text-primary">{typeof latestVal === 'number' ? (dataKey.toString().includes('latency') ? latestVal.toFixed(2) + ' ms' : formatNumber(latestVal)) : latestVal}</p>
      </div>
      <canvas ref={canvasRef} className="w-full h-12" style={{ display: data.length < 2 ? 'none' : 'block' }} />
      {data.length < 2 && <div className="h-12 flex items-center justify-center text-text-muted text-[11px]">No data</div>}
    </div>
  );
});

// ─── Top Queries Table ───

function QueriesTable({ queries }: { queries: DbQueryInfo[] }) {
  const [sortKey, setSortKey] = useState<'frequency' | 'avg_latency_ms' | 'error_count'>('frequency');
  const [searchFilter, setSearchFilter] = useState('');

  const sorted = [...queries]
    .filter(q => !searchFilter || q.resource.toLowerCase().includes(searchFilter.toLowerCase()))
    .sort((a, b) => (b[sortKey] as number) - (a[sortKey] as number));

  return (
    <div className="glass-panel">
      <div className="flex items-center justify-between p-4 border-b border-border">
        <h3 className="text-sm font-semibold text-text-primary flex items-center gap-2">
          <Database className="w-4 h-4 text-brand-light" />
          Top Queries
          <span className="badge badge-info font-mono text-[10px]">{queries.length}</span>
        </h3>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted" />
            <input
              type="text"
              placeholder="Filter queries..."
              value={searchFilter}
              onChange={e => setSearchFilter(e.target.value)}
              className="bg-surface-light border border-border rounded-lg pl-8 pr-3 py-1.5 text-[12px] text-text-primary w-52 focus:outline-none focus:border-brand/50"
            />
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-[12px]">
          <thead>
            <tr className="border-b border-border text-text-muted uppercase tracking-wider">
              <th className="text-left py-2.5 px-4 font-medium">Query</th>
              <th
                className="text-right py-2.5 px-3 font-medium cursor-pointer hover:text-text-primary"
                onClick={() => setSortKey('frequency')}
              >
                <span className="flex items-center justify-end gap-1">
                  Calls {sortKey === 'frequency' && <ArrowUpDown className="w-3 h-3" />}
                </span>
              </th>
              <th
                className="text-right py-2.5 px-3 font-medium cursor-pointer hover:text-text-primary"
                onClick={() => setSortKey('avg_latency_ms')}
              >
                <span className="flex items-center justify-end gap-1">
                  Avg {sortKey === 'avg_latency_ms' && <ArrowUpDown className="w-3 h-3" />}
                </span>
              </th>
              <th className="text-right py-2.5 px-3 font-medium">P95</th>
              <th
                className="text-right py-2.5 px-3 font-medium cursor-pointer hover:text-text-primary"
                onClick={() => setSortKey('error_count')}
              >
                <span className="flex items-center justify-end gap-1">
                  Errors {sortKey === 'error_count' && <ArrowUpDown className="w-3 h-3" />}
                </span>
              </th>
              <th className="text-left py-2.5 px-3 font-medium">Services</th>
            </tr>
          </thead>
          <tbody>
            {sorted.slice(0, 30).map((q, i) => (
              <tr key={i} className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors">
                <td className="py-2.5 px-4 max-w-[400px]">
                  <div className="font-mono text-text-primary truncate" title={q.resource}>
                    {q.resource || '(empty)'}
                  </div>
                </td>
                <td className="py-2.5 px-3 text-right font-mono tabular-nums text-text-primary">
                  {formatNumber(q.frequency)}
                </td>
                <td className="py-2.5 px-3 text-right font-mono tabular-nums text-text-primary">
                  {q.avg_latency_ms.toFixed(2)} ms
                </td>
                <td className="py-2.5 px-3 text-right font-mono tabular-nums text-text-primary">
                  {q.p95_latency_ms.toFixed(2)} ms
                </td>
                <td className="py-2.5 px-3 text-right">
                  {q.error_count > 0 ? (
                    <span className="font-mono tabular-nums text-danger">{q.error_count}</span>
                  ) : (
                    <span className="font-mono tabular-nums text-text-muted">0</span>
                  )}
                </td>
                <td className="py-2.5 px-3">
                  <div className="flex flex-wrap gap-1">
                    {q.services.slice(0, 3).map(s => (
                      <Link key={s} to={`/apm/services/${s}`} className="badge badge-info text-[10px] hover:text-brand-light transition-colors">
                        {s}
                      </Link>
                    ))}
                    {q.services.length > 3 && <span className="text-[10px] text-text-muted">+{q.services.length - 3}</span>}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {sorted.length === 0 && (
        <div className="p-8 text-center text-text-muted text-[12px]">No queries found</div>
      )}
    </div>
  );
}

// ─── Slow Queries Panel ───

function SlowQueriesPanel({ queries, thresholdMs }: { queries: SlowQueryInfo[]; thresholdMs: number }) {
  return (
    <div className="glass-panel">
      <div className="flex items-center justify-between p-4 border-b border-border">
        <h3 className="text-sm font-semibold text-text-primary flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-warning" />
          Slow Queries
          <span className="text-[10px] text-text-muted font-normal">&gt; P95 ({thresholdMs.toFixed(0)} ms)</span>
        </h3>
        <span className="badge badge-danger font-mono text-[10px]">{queries.length}</span>
      </div>

      {queries.length === 0 ? (
        <div className="p-8 text-center text-text-muted text-[12px]">
          <Clock className="w-5 h-5 mx-auto mb-2 opacity-40" />
          No slow queries in this time range
        </div>
      ) : (
        <div className="divide-y divide-white/[0.03] max-h-[400px] overflow-auto">
          {queries.slice(0, 20).map((q, i) => (
            <div key={i} className="px-4 py-3 hover:bg-white/[0.02] transition-colors">
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2">
                  <span className={`w-1.5 h-1.5 rounded-full ${q.error ? 'bg-danger' : 'bg-warning'}`} />
                  <span className="text-[12px] font-mono text-text-secondary">{q.service}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-[12px] font-mono tabular-nums text-warning font-semibold">
                    {q.duration_ms.toFixed(1)} ms
                  </span>
                  <Link to={`/traces/${q.trace_id}`} className="text-[10px] text-brand-light hover:underline flex items-center gap-1">
                    <Zap className="w-3 h-3" /> trace
                  </Link>
                </div>
              </div>
              <p className="text-[11px] font-mono text-text-muted truncate" title={q.resource}>
                {q.resource || '(empty)'}
              </p>
              <p className="text-[10px] text-text-muted mt-1">
                {new Date(q.timestamp_ms).toLocaleTimeString()}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Services Table ───

function ServicesTable({ services }: { services: DbServiceInfo[] }) {
  return (
    <div className="glass-panel">
      <div className="p-4 border-b border-border">
        <h3 className="text-sm font-semibold text-text-primary flex items-center gap-2">
          <Server className="w-4 h-4 text-brand-light" />
          Connected Services
        </h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-[12px]">
          <thead>
            <tr className="border-b border-border text-text-muted uppercase tracking-wider">
              <th className="text-left py-2.5 px-4 font-medium">Service</th>
              <th className="text-right py-2.5 px-3 font-medium">Queries</th>
              <th className="text-right py-2.5 px-3 font-medium">Errors</th>
              <th className="text-right py-2.5 px-3 font-medium">Err %</th>
              <th className="text-right py-2.5 px-3 font-medium">Avg</th>
              <th className="text-right py-2.5 px-3 font-medium">P95</th>
            </tr>
          </thead>
          <tbody>
            {services.map(s => (
              <tr key={s.service} className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors">
                <td className="py-2.5 px-4">
                  <Link to={`/apm/services/${s.service}`} className="text-brand-light hover:underline font-medium">
                    {s.service}
                  </Link>
                </td>
                <td className="py-2.5 px-3 text-right font-mono tabular-nums text-text-primary">{formatNumber(s.query_count)}</td>
                <td className="py-2.5 px-3 text-right font-mono tabular-nums">
                  {s.error_count > 0 ? <span className="text-danger">{s.error_count}</span> : <span className="text-text-muted">0</span>}
                </td>
                <td className="py-2.5 px-3 text-right font-mono tabular-nums">
                  <span className={s.error_rate > 5 ? 'text-danger' : s.error_rate > 1 ? 'text-warning' : 'text-text-secondary'}>{s.error_rate.toFixed(1)}%</span>
                </td>
                <td className="py-2.5 px-3 text-right font-mono tabular-nums text-text-primary">{s.avg_latency_ms.toFixed(2)} ms</td>
                <td className="py-2.5 px-3 text-right font-mono tabular-nums text-text-primary">{s.p95_latency_ms.toFixed(2)} ms</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {services.length === 0 && (
        <div className="p-8 text-center text-text-muted text-[12px]">No services found</div>
      )}
    </div>
  );
}

// ─── Helpers ───

function formatNumber(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
  return Math.round(n).toLocaleString();
}

// ─── Main Page ───

export default function DatabaseMonitoring() {
  const [databases, setDatabases] = useState<DatabaseInfo[]>([]);
  const [selectedDb, setSelectedDb] = useState<string | null>(null);
  const [queries, setQueries] = useState<DbQueryInfo[]>([]);
  const [slowQueries, setSlowQueries] = useState<SlowQueryInfo[]>([]);
  const [slowThreshold, setSlowThreshold] = useState(100);
  const [services, setServices] = useState<DbServiceInfo[]>([]);
  const [timeseries, setTimeseries] = useState<DbTimePoint[]>([]);
  const [timeRange, setTimeRange] = useState('1h');
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);

  // Load database overview
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const data = await apiFetch(`/api/v1/databases?from=${timeRange}`);
        setDatabases(data.databases || []);
        if (!selectedDb && data.databases?.length > 0) {
          setSelectedDb(data.databases[0].db_type);
        }
      } catch (err) {
        console.error(err);
      }
      setLoading(false);
    };
    load();
  }, [timeRange, selectedDb]);

  // Load details for selected DB type
  useEffect(() => {
    const load = async () => {
      if (!selectedDb) return;
      setDetailLoading(true);

      try {
        const [qData, slowData, svcData, tsData] = await Promise.all([
          apiFetch(`/api/v1/databases/${selectedDb}/queries?from=${timeRange}`),
          apiFetch(`/api/v1/databases/${selectedDb}/slow-queries?from=${timeRange}`),
          apiFetch(`/api/v1/databases/${selectedDb}/services?from=${timeRange}`),
          apiFetch(`/api/v1/databases/${selectedDb}/timeseries?from=${timeRange}`),
        ]);
        setQueries(qData.queries || []);
        setSlowQueries(slowData.queries || []);
        setSlowThreshold(slowData.threshold_ms || 100);
        setServices(svcData.services || []);
        setTimeseries(tsData.timeseries || []);
      } catch (err) {
        console.error(err);
      }
      setDetailLoading(false);
    };
    load();
  }, [selectedDb, timeRange]);

  const timeRanges = ['1h', '6h', '24h', '7d'];

  return (
    <div className="page-container">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="page-title flex items-center gap-2">
            <Database className="w-5 h-5 text-brand-light" />
            Database Monitoring
          </h1>
          <p className="text-[13px] text-text-secondary mt-1">
            Query performance and health metrics derived from distributed traces.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {timeRanges.map(t => (
            <button
              key={t}
              onClick={() => setTimeRange(t)}
              className={`px-3 py-1.5 rounded-lg text-[12px] font-medium transition-all ${
                timeRange === t
                  ? 'bg-brand/20 text-brand-light border border-brand/30'
                  : 'text-text-secondary hover:text-text-primary hover:bg-surface-light border border-transparent'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center items-center h-64">
          <Loader2 className="w-6 h-6 animate-spin text-brand-light" />
        </div>
      ) : databases.length === 0 ? (
        <div className="glass-panel p-12 text-center border-dashed border-2 border-border bg-transparent">
          <Database className="w-10 h-10 text-text-muted mx-auto mb-3" />
          <h3 className="text-sm font-semibold mb-1 text-text-primary">No database operations detected</h3>
          <p className="text-[11px] text-text-muted">Database queries will appear here once services produce postgresql.query or redis.query spans.</p>
        </div>
      ) : (
        <>
          {/* Database Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mb-6">
            {databases.map(db => (
              <DatabaseCard
                key={db.db_type}
                db={db}
                onClick={() => setSelectedDb(db.db_type)}
                isSelected={selectedDb === db.db_type}
              />
            ))}
          </div>

          {/* Detail view */}
          {selectedDb && (
            detailLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="w-5 h-5 animate-spin text-brand-light" />
              </div>
            ) : (
              <div className="space-y-6">
                {/* Timeseries Charts */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <MiniChart data={timeseries} dataKey="query_count" color="#7c5cfc" label="Query Rate" />
                  <MiniChart data={timeseries} dataKey="error_count" color="#ef4444" label="Errors" />
                  <MiniChart data={timeseries} dataKey="avg_latency_ms" color="#22c55e" label="Avg Latency" />
                  <MiniChart data={timeseries} dataKey="p95_latency_ms" color="#f59e0b" label="P95 Latency" />
                </div>

                {/* Queries + Slow Queries side by side */}
                <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                  <div className="xl:col-span-2">
                    <QueriesTable queries={queries} />
                  </div>
                  <div>
                    <SlowQueriesPanel queries={slowQueries} thresholdMs={slowThreshold} />
                  </div>
                </div>

                {/* Services */}
                <ServicesTable services={services} />
              </div>
            )
          )}
        </>
      )}
    </div>
  );
}
