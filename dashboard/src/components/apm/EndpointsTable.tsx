import { useState, useMemo, useEffect } from 'react';
import { Activity, ChevronDown, ChevronUp, ChevronRight, Clock, AlertTriangle, Layers } from 'lucide-react';
import type { ResourceWithMetrics } from '../../lib/api';
import { searchTraces, fetchTrace, type TraceSummary, type SpanResponse } from '../../lib/api';

interface EndpointsTableProps {
  resources: ResourceWithMetrics[];
  serviceName: string;
}

type SortKey = 'resource' | 'requests' | 'errors' | 'error_rate' | 'avg_duration_ms' | 'p95_duration_ms';

function formatNum(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return Math.round(n).toString();
}

function isApiEndpoint(resource: string): boolean {
  if (resource.includes('.request') || resource.includes('.server')) return true;
  const methods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'];
  for (const m of methods) {
    if (resource.startsWith(`${m} `)) return true;
    if (resource === m) return true;
    if (resource.includes(` ${m} `)) return true;
  }
  if (resource.startsWith('/')) return true;
  if (resource.includes('/api/')) return true;
  return false;
}

function extractMethod(resource: string): { method: string | null; path: string } {
  const match = resource.match(/(?:^|\s)(GET|POST|PUT|DELETE|PATCH|HEAD|OPTIONS)(?:\s|$)/);
  if (match) {
    const method = match[1];
    const pathIndex = resource.indexOf(method) + method.length;
    let path = resource.slice(pathIndex).trim();
    if (!path) path = '/';
    return { method, path };
  }
  return { method: null, path: resource };
}

const methodColors: Record<string, string> = {
  GET: 'bg-blue-500/20 text-blue-400',
  POST: 'bg-green-500/20 text-green-400',
  PUT: 'bg-amber-500/20 text-amber-400',
  DELETE: 'bg-red-500/20 text-red-400',
  PATCH: 'bg-purple-500/20 text-purple-400',
};

function formatDuration(ms: number): string {
  if (ms < 1) return `${(ms * 1000).toFixed(0)}µs`;
  if (ms < 1000) return `${ms.toFixed(1)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

function formatTimestamp(ts: string): string {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

export function EndpointsTable({ resources, serviceName }: EndpointsTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>('requests');
  const [sortAsc, setSortAsc] = useState(false);
  const [expandedEndpoint, setExpandedEndpoint] = useState<string | null>(null);
  const [traces, setTraces] = useState<TraceSummary[]>([]);
  const [selectedTraceSpans, setSelectedTraceSpans] = useState<SpanResponse[]>([]);
  const [selectedTraceId, setSelectedTraceId] = useState<string | null>(null);
  const [loadingTraces, setLoadingTraces] = useState(false);
  const [loadingSpans, setLoadingSpans] = useState(false);

  // Filter to only API endpoints
  const apiEndpoints = useMemo(() => resources.filter(r => isApiEndpoint(r.resource)), [resources]);

  const sorted = useMemo(() => {
    const arr = [...apiEndpoints];
    arr.sort((a, b) => {
      const va = a[sortKey] as number;
      const vb = b[sortKey] as number;
      if (typeof va === 'string') return sortAsc ? (va as string).localeCompare(vb as string) : (vb as string).localeCompare(va as string);
      return sortAsc ? va - vb : vb - va;
    });
    return arr;
  }, [apiEndpoints, sortKey, sortAsc]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc(!sortAsc);
    else { setSortKey(key); setSortAsc(false); }
  };

  // Load traces when an endpoint is expanded
  useEffect(() => {
    if (!expandedEndpoint) { setTraces([]); setSelectedTraceId(null); setSelectedTraceSpans([]); return; }
    setLoadingTraces(true);
    searchTraces({ service: serviceName, resource: expandedEndpoint, limit: 20 })
      .then(r => setTraces(r.traces || []))
      .catch(() => setTraces([]))
      .finally(() => setLoadingTraces(false));
  }, [expandedEndpoint, serviceName]);

  // Load span details when a trace is selected
  useEffect(() => {
    if (!selectedTraceId) { setSelectedTraceSpans([]); return; }
    setLoadingSpans(true);
    fetchTrace(selectedTraceId)
      .then(spans => setSelectedTraceSpans(spans))
      .catch(() => setSelectedTraceSpans([]))
      .finally(() => setLoadingSpans(false));
  }, [selectedTraceId]);

  const handleEndpointClick = (resource: string) => {
    if (expandedEndpoint === resource) {
      setExpandedEndpoint(null);
    } else {
      setExpandedEndpoint(resource);
      setSelectedTraceId(null);
    }
  };

  const SortIcon = ({ col }: { col: SortKey }) => {
    if (sortKey !== col) return null;
    return sortAsc ? <ChevronUp size={12} /> : <ChevronDown size={12} />;
  };

  return (
    <div className="glass-panel p-4 shadow-xl">
      <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4 flex items-center gap-2">
        <Activity className="w-4 h-4 text-primary" /> Endpoints
        <span className="bg-white/10 text-gray-400 text-xs px-2 py-0.5 rounded-full ml-2">{apiEndpoints.length}</span>
      </h3>

      {apiEndpoints.length === 0 ? (
        <p className="text-gray-500 text-center py-8 text-sm">No endpoint data available yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-400 border-b border-white/10">
                <th className="pb-3 font-semibold cursor-pointer hover:text-white" onClick={() => handleSort('resource')}>
                  <span className="flex items-center gap-1">Endpoint <SortIcon col="resource" /></span>
                </th>
                <th className="pb-3 font-semibold text-right cursor-pointer hover:text-white" onClick={() => handleSort('requests')}>
                  <span className="flex items-center justify-end gap-1">Requests <SortIcon col="requests" /></span>
                </th>
                <th className="pb-3 font-semibold text-right cursor-pointer hover:text-white" onClick={() => handleSort('errors')}>
                  <span className="flex items-center justify-end gap-1">Errors <SortIcon col="errors" /></span>
                </th>
                <th className="pb-3 font-semibold text-right cursor-pointer hover:text-white" onClick={() => handleSort('error_rate')}>
                  <span className="flex items-center justify-end gap-1">Error Rate <SortIcon col="error_rate" /></span>
                </th>
                <th className="pb-3 font-semibold text-right cursor-pointer hover:text-white" onClick={() => handleSort('avg_duration_ms')}>
                  <span className="flex items-center justify-end gap-1">Avg Latency <SortIcon col="avg_duration_ms" /></span>
                </th>
                <th className="pb-3 font-semibold text-right cursor-pointer hover:text-white" onClick={() => handleSort('p95_duration_ms')}>
                  <span className="flex items-center justify-end gap-1">P95 <SortIcon col="p95_duration_ms" /></span>
                </th>
                <th className="pb-3 w-8"></th>
              </tr>
            </thead>
            <tbody>
              {sorted.map(r => {
                const { method, path } = extractMethod(r.resource);
                const isExpanded = expandedEndpoint === r.resource;
                return (
                  <tr key={r.resource} className="border-b border-white/5">
                    {/* Endpoint row */}
                    <td colSpan={7} className="p-0">
                      <div
                        onClick={() => handleEndpointClick(r.resource)}
                        className={`flex items-center cursor-pointer transition-colors group py-3 px-1 ${
                          isExpanded ? 'bg-primary/5' : 'hover:bg-white/5'
                        }`}
                      >
                        {/* Endpoint name */}
                        <div className="flex-1 flex items-center gap-2 group-hover:text-primary transition-colors">
                          <ChevronRight className={`w-4 h-4 text-gray-600 transition-transform ${isExpanded ? 'rotate-90 text-primary' : 'group-hover:text-primary'}`} />
                          {method && (
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${methodColors[method] || 'bg-gray-500/20 text-gray-400'}`}>
                              {method}
                            </span>
                          )}
                          <span className="font-mono text-xs text-gray-200 truncate">{path}</span>
                        </div>
                        {/* Metrics */}
                        <span className="w-20 text-right font-mono text-xs">{formatNum(r.requests)}</span>
                        <span className="w-20 text-right font-mono text-xs text-red-400">{formatNum(r.errors)}</span>
                        <span className="w-24 text-right">
                          <span className={`text-xs font-bold ${r.error_rate < 5 ? 'text-emerald-400' : 'text-red-400'}`}>
                            {r.error_rate.toFixed(1)}%
                          </span>
                        </span>
                        <span className={`w-24 text-right font-mono text-xs ${
                          r.avg_duration_ms >= 500 ? 'text-red-400' : r.avg_duration_ms >= 100 ? 'text-amber-400' : 'text-gray-200'
                        }`}>
                          {r.avg_duration_ms.toFixed(1)}ms
                        </span>
                        <span className="w-24 text-right font-mono text-xs text-amber-400">{r.p95_duration_ms.toFixed(1)}ms</span>
                        <span className="w-8" />
                      </div>

                      {/* Expanded: Trace list */}
                      {isExpanded && (
                        <div className="border-t border-white/5 bg-black/20">
                          {loadingTraces ? (
                            <div className="flex items-center justify-center py-6">
                              <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                            </div>
                          ) : traces.length === 0 ? (
                            <p className="text-gray-500 text-sm text-center py-4">No recent traces for this endpoint.</p>
                          ) : (
                            <div className="divide-y divide-white/5">
                              {traces.map(t => (
                                <div key={t.trace_id}>
                                  {/* Trace summary row */}
                                  <div
                                    onClick={(e) => { e.stopPropagation(); setSelectedTraceId(selectedTraceId === t.trace_id ? null : t.trace_id); }}
                                    className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer transition-colors ${
                                      selectedTraceId === t.trace_id ? 'bg-primary/10' : 'hover:bg-white/5'
                                    }`}
                                  >
                                    <ChevronRight className={`w-3.5 h-3.5 text-gray-600 transition-transform flex-shrink-0 ${
                                      selectedTraceId === t.trace_id ? 'rotate-90 text-primary' : ''
                                    }`} />
                                    <span className="font-mono text-[11px] text-primary/80 w-24 flex-shrink-0">{t.trace_id.slice(0, 12)}…</span>
                                    <span className="text-xs text-gray-400 flex items-center gap-1 flex-shrink-0">
                                      <Clock size={11} /> {formatTimestamp(t.timestamp)}
                                    </span>
                                    <span className={`text-xs font-mono flex-shrink-0 ${
                                      t.duration_ms >= 500 ? 'text-red-400' : t.duration_ms >= 100 ? 'text-amber-400' : 'text-emerald-400'
                                    }`}>
                                      {formatDuration(t.duration_ms)}
                                    </span>
                                    <span className="text-xs text-gray-500 flex items-center gap-1 flex-shrink-0">
                                      <Layers size={11} /> {t.span_count} spans
                                    </span>
                                    {t.error && (
                                      <span className="text-xs text-red-400 flex items-center gap-1 flex-shrink-0">
                                        <AlertTriangle size={11} /> Error
                                      </span>
                                    )}
                                    <span className="flex-1 text-xs text-gray-500 truncate">{t.root_name}</span>
                                  </div>

                                  {/* Span details */}
                                  {selectedTraceId === t.trace_id && (
                                    <div className="bg-black/30 border-t border-white/5">
                                      {loadingSpans ? (
                                        <div className="flex items-center justify-center py-4">
                                          <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                                        </div>
                                      ) : (
                                        <div className="px-4 py-2 space-y-0.5 max-h-80 overflow-y-auto">
                                          {selectedTraceSpans.map((span, i) => {
                                            const depth = getSpanDepth(span, selectedTraceSpans);
                                            const maxDuration = Math.max(...selectedTraceSpans.map(s => s.duration_ms), 1);
                                            const widthPct = Math.max((span.duration_ms / maxDuration) * 100, 2);
                                            return (
                                              <div key={`${span.span_id}-${i}`} className="flex items-center gap-2 py-1 group/span hover:bg-white/5 rounded px-1">
                                                <div style={{ width: `${depth * 16}px` }} className="flex-shrink-0" />
                                                <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded flex-shrink-0 ${
                                                  span.service === serviceName
                                                    ? 'bg-primary/20 text-primary'
                                                    : 'bg-cyan-500/20 text-cyan-400'
                                                }`}>
                                                  {span.service}
                                                </span>
                                                <span className={`text-xs truncate flex-1 ${span.error ? 'text-red-400' : 'text-gray-300'}`}>
                                                  {span.name}
                                                </span>
                                                <div className="w-32 flex-shrink-0">
                                                  <div className="w-full h-1.5 bg-black/40 rounded-full overflow-hidden">
                                                    <div
                                                      className={`h-full rounded-full ${span.error ? 'bg-red-500' : 'bg-primary/60'}`}
                                                      style={{ width: `${widthPct}%` }}
                                                    />
                                                  </div>
                                                </div>
                                                <span className={`text-[11px] font-mono w-16 text-right flex-shrink-0 ${
                                                  span.duration_ms >= 100 ? 'text-amber-400' : 'text-gray-400'
                                                }`}>
                                                  {formatDuration(span.duration_ms)}
                                                </span>
                                              </div>
                                            );
                                          })}
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function getSpanDepth(span: SpanResponse, allSpans: SpanResponse[]): number {
  let depth = 0;
  let current = span;
  const visited = new Set<string>();
  while (current.parent_id && !visited.has(current.parent_id)) {
    visited.add(current.parent_id);
    const parent = allSpans.find(s => s.span_id === current.parent_id);
    if (!parent) break;
    depth++;
    current = parent;
  }
  return Math.min(depth, 8);
}
