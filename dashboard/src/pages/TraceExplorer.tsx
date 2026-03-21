import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { Search, Filter, Zap } from 'lucide-react';
import { searchTraces, fetchServices, type TraceSummary } from '../lib/api';

export default function TraceExplorer() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  
  const [services, setServices] = useState<string[]>([]);
  const [service, setService] = useState(searchParams.get('service') || '');
  const [status, setStatus] = useState('all');
  const [minDuration, setMinDuration] = useState('');
  const [maxDuration, setMaxDuration] = useState('');
  const [traceIdInput, setTraceIdInput] = useState('');
  const [traces, setTraces] = useState<TraceSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const limit = 50;

  useEffect(() => {
    fetchServices().then(setServices);
  }, []);

  useEffect(() => {
    doSearch();
  }, [service, status, offset]);

  const doSearch = async () => {
    setLoading(true);
    try {
      const filters: any = { limit, offset };
      if (service) filters.service = service;
      if (status === 'error') filters.status = 'error';
      if (status === 'ok') filters.status = 'ok';
      if (minDuration) filters.min_duration_ms = parseFloat(minDuration);
      if (maxDuration) filters.max_duration_ms = parseFloat(maxDuration);
      const res = await searchTraces(filters);
      setTraces(res.traces);
      setTotal(res.total);
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  const handleDirectLookup = (e: React.FormEvent) => {
    e.preventDefault();
    if (traceIdInput.trim()) {
      navigate(`/traces/${traceIdInput.trim()}`);
    }
  };

  const maxDur = Math.max(...traces.map(t => t.duration_ms), 1);

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex justify-between items-end mb-8">
        <div>
          <h1 className="text-4xl font-extrabold tracking-tight mb-2">Trace Explorer</h1>
          <p className="text-gray-400">Search and analyze distributed traces across all services.</p>
        </div>
        <span className="px-3 py-1 glass-panel text-sm text-gray-300 font-mono shadow-md">{total} traces</span>
      </div>

      {/* Filter Bar */}
      <div className="glass-panel p-4 mb-6 shadow-xl">
        <div className="flex flex-wrap gap-3 items-center">
          <Filter className="w-4 h-4 text-gray-400" />
          
          {/* Service */}
          <select value={service} onChange={e => { setService(e.target.value); setOffset(0); }}
            className="bg-surface/50 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-primary/50">
            <option value="">All Services</option>
            {services.map(s => <option key={s} value={s}>{s}</option>)}
          </select>

          {/* Status */}
          <div className="flex gap-1 bg-black/30 rounded-lg p-0.5">
            {['all', 'ok', 'error'].map(s => (
              <button key={s} onClick={() => { setStatus(s); setOffset(0); }}
                className={`px-3 py-1.5 text-xs rounded font-bold transition-all ${status === s 
                  ? s === 'error' ? 'bg-red-500/30 text-red-400' : s === 'ok' ? 'bg-emerald-500/30 text-emerald-400' : 'bg-primary/30 text-primary' 
                  : 'text-gray-400 hover:text-white'}`}>
                {s.toUpperCase()}
              </button>
            ))}
          </div>

          {/* Duration */}
          <div className="flex items-center gap-1">
            <input type="number" placeholder="Min ms" value={minDuration} onChange={e => setMinDuration(e.target.value)}
              className="bg-surface/50 border border-white/10 rounded-lg px-2 py-2 text-sm text-white w-20 focus:outline-none focus:border-primary/50" />
            <span className="text-gray-500">—</span>
            <input type="number" placeholder="Max ms" value={maxDuration} onChange={e => setMaxDuration(e.target.value)}
              className="bg-surface/50 border border-white/10 rounded-lg px-2 py-2 text-sm text-white w-20 focus:outline-none focus:border-primary/50" />
          </div>

          <button onClick={() => { setOffset(0); doSearch(); }}
            className="bg-primary hover:bg-primary/80 text-white px-4 py-2 rounded-lg text-sm font-bold transition-all shadow-lg hover:shadow-primary/20">
            Search
          </button>

          {/* Direct Trace ID */}
          <form onSubmit={handleDirectLookup} className="ml-auto flex gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 w-4 h-4" />
              <input type="text" placeholder="Trace ID..." value={traceIdInput} onChange={e => setTraceIdInput(e.target.value)}
                className="bg-surface/50 border border-white/10 rounded-lg pl-9 pr-3 py-2 text-sm text-white w-44 focus:outline-none focus:border-primary/50 font-mono" />
            </div>
            <button type="submit" className="bg-white/10 hover:bg-white/20 text-white px-3 py-2 rounded-lg text-sm transition-all">Go</button>
          </form>
        </div>
      </div>

      {/* Results Table */}
      <div className="glass-panel shadow-2xl overflow-hidden">
        {loading ? (
          <div className="flex justify-center items-center h-64">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : traces.length === 0 ? (
          <div className="p-12 text-center">
            <Zap className="w-12 h-12 text-gray-600 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-gray-300 mb-2">No traces found</h3>
            <p className="text-gray-500">Adjust your filters or wait for new trace data.</p>
          </div>
        ) : (
          <>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-400 bg-black/30">
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold">Trace ID</th>
                  <th className="px-4 py-3 font-semibold">Service</th>
                  <th className="px-4 py-3 font-semibold">Operation</th>
                  <th className="px-4 py-3 font-semibold">Duration</th>
                  <th className="px-4 py-3 font-semibold text-right">Spans</th>
                  <th className="px-4 py-3 font-semibold text-right">Time</th>
                </tr>
              </thead>
              <tbody>
                {traces.map(t => (
                  <tr key={t.trace_id}
                    onClick={() => navigate(`/traces/${t.trace_id}`)}
                    className="border-t border-white/5 hover:bg-white/5 cursor-pointer transition-colors group">
                    <td className="px-4 py-3">
                      <span className={`w-2 h-2 rounded-full inline-block ${t.error ? 'bg-red-500' : 'bg-emerald-500'}`} />
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-300 group-hover:text-primary transition-colors">
                      {t.trace_id.slice(0, 16)}
                    </td>
                    <td className="px-4 py-3 text-primary font-semibold">{t.root_service}</td>
                    <td className="px-4 py-3 text-gray-300 truncate max-w-[200px]">{t.root_name}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-24 h-1.5 bg-black/40 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full ${t.error ? 'bg-red-500' : 'bg-primary'}`}
                            style={{ width: `${Math.min((t.duration_ms / maxDur) * 100, 100)}%` }} />
                        </div>
                        <span className="font-mono text-xs text-amber-400">{t.duration_ms.toFixed(1)}ms</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-gray-500">{t.span_count}</td>
                    <td className="px-4 py-3 text-right text-gray-500 text-xs">{new Date(t.timestamp).toLocaleTimeString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Pagination */}
            <div className="flex justify-between items-center px-4 py-3 bg-black/20 border-t border-white/5">
              <button onClick={() => setOffset(Math.max(0, offset - limit))} disabled={offset === 0}
                className="text-sm text-gray-400 hover:text-white disabled:opacity-30 transition-colors">
                ← Previous
              </button>
              <span className="text-xs text-gray-500">
                Showing {offset + 1}–{Math.min(offset + limit, total)} of {total}
              </span>
              <button onClick={() => setOffset(offset + limit)} disabled={offset + limit >= total}
                className="text-sm text-gray-400 hover:text-white disabled:opacity-30 transition-colors">
                Next →
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
