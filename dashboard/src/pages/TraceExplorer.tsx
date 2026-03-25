import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Search, Filter, Zap, Loader2 } from 'lucide-react';
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

  const doSearch = async () => {
    setLoading(true);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
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

  useEffect(() => {
    doSearch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [service, status, offset]);



  const handleDirectLookup = (e: React.FormEvent) => {
    e.preventDefault();
    if (traceIdInput.trim()) {
      navigate(`/traces/${traceIdInput.trim()}`);
    }
  };

  const maxDur = Math.max(...traces.map(t => t.duration_ms), 1);

  return (
    <div className="page-container">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="page-title">Trace Explorer</h1>
          <p className="text-[13px] text-gray-400 mt-1">Search and analyze distributed traces across all services.</p>
        </div>
        <span className="badge badge-info font-mono">{total} traces</span>
      </div>

      {/* Filter Bar */}
      <div className="glass-panel p-4 mb-4">
        <div className="flex flex-wrap gap-3 items-center">
          <Filter className="w-4 h-4 text-gray-400" />
          
          {/* Service */}
          <select value={service} onChange={e => { setService(e.target.value); setOffset(0); }}
            className="filter-select">
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
              className="search-input px-2 w-20" />
            <span className="text-gray-500">—</span>
            <input type="number" placeholder="Max ms" value={maxDuration} onChange={e => setMaxDuration(e.target.value)}
              className="search-input px-2 w-20" />
          </div>

          <button onClick={() => { setOffset(0); doSearch(); }}
            className="btn-primary">
            Search
          </button>

          {/* Direct Trace ID */}
          <form onSubmit={handleDirectLookup} className="ml-auto flex gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 w-4 h-4" />
              <input type="text" placeholder="Trace ID..." value={traceIdInput} onChange={e => setTraceIdInput(e.target.value)}
                className="search-input pl-9 pr-3 w-44 font-mono" />
            </div>
            <button type="submit" className="btn-ghost">Go</button>
          </form>
        </div>
      </div>

      {/* Results Table */}
      <div className="glass-panel overflow-hidden">
        {loading ? (
          <div className="flex justify-center items-center h-64">
            <Loader2 className="w-6 h-6 animate-spin text-brand-light" />
          </div>
        ) : traces.length === 0 ? (
          <div className="p-12 text-center">
            <Zap className="w-10 h-10 text-gray-600 mx-auto mb-3" />
            <h3 className="text-sm font-semibold text-gray-300 mb-1">No traces found</h3>
            <p className="text-[11px] text-gray-500">Adjust your filters or wait for new trace data.</p>
          </div>
        ) : (
          <>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Status</th>
                  <th>Trace ID</th>
                  <th>Service</th>
                  <th>Operation</th>
                  <th>Duration</th>
                  <th className="text-right">Spans</th>
                  <th className="text-right">Time</th>
                </tr>
              </thead>
              <tbody>
                {traces.map(t => (
                  <tr key={t.trace_id}
                    onClick={() => navigate(`/traces/${t.trace_id}`)}
                    className="cursor-pointer group">
                    <td>
                      <span className={`w-2 h-2 rounded-full inline-block ${t.error ? 'bg-danger' : 'bg-success'}`} />
                    </td>
                    <td className="font-mono text-[12px] text-gray-400 group-hover:text-brand-light transition-colors">
                      {t.trace_id.slice(0, 16)}
                    </td>
                    <td className="text-brand-light font-semibold">{t.root_service}</td>
                    <td className="text-gray-300 truncate max-w-[200px]">{t.root_name}</td>
                    <td>
                      <div className="flex items-center gap-2">
                        <div className="w-24 h-1.5 bg-black/40 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full ${t.error ? 'bg-danger' : 'bg-brand'}`}
                            style={{ width: `${Math.min((t.duration_ms / maxDur) * 100, 100)}%` }} />
                        </div>
                        <span className="font-mono text-[12px] tabular-nums text-warning">{t.duration_ms.toFixed(1)}ms</span>
                      </div>
                    </td>
                    <td className="text-right font-mono text-[12px] tabular-nums text-gray-500">{t.span_count}</td>
                    <td className="text-right text-gray-500 text-[11px]">{new Date(t.timestamp).toLocaleTimeString()}</td>
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
