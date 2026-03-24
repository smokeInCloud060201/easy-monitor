import { useState, useMemo, useEffect } from 'react';
import { Activity, ChevronDown, ChevronUp } from 'lucide-react';
import type { ResourceWithMetrics } from '../../lib/api';
import { searchTraces, type TraceSummary } from '../../lib/api';
import { SpanDrawer } from './SpanDrawer';

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

export function EndpointsTable({ resources, serviceName }: EndpointsTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>('requests');
  const [sortAsc, setSortAsc] = useState(false);
  const [drawerEndpoint, setDrawerEndpoint] = useState<string | null>(null);
  const [traces, setTraces] = useState<TraceSummary[]>([]);
  const [loadingTraces, setLoadingTraces] = useState(false);

  // Filter to only API endpoints
  const apiEndpoints = useMemo(() => resources.filter(r => isApiEndpoint(r.resource)), [resources]);

  const sorted = useMemo(() => {
    const arr = [...apiEndpoints];
    arr.sort((a, b) => {
      const va = a[sortKey];
      const vb = b[sortKey];
      if (typeof va === 'string' && typeof vb === 'string') return sortAsc ? va.localeCompare(vb) : vb.localeCompare(va);
      return sortAsc ? (va as number) - (vb as number) : (vb as number) - (va as number);
    });
    return arr;
  }, [apiEndpoints, sortKey, sortAsc]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc(!sortAsc);
    else { setSortKey(key); setSortAsc(false); }
  };

  // Load traces when a drawer endpoint is selected
  useEffect(() => {
    if (!drawerEndpoint) { setTraces([]); return; }
    setLoadingTraces(true);
    searchTraces({ service: serviceName, resource: drawerEndpoint, limit: 20 })
      .then(r => setTraces(r.traces || []))
      .catch(() => setTraces([]))
      .finally(() => setLoadingTraces(false));
  }, [drawerEndpoint, serviceName]);

  const handleEndpointClick = (resource: string) => {
    setDrawerEndpoint(drawerEndpoint === resource ? null : resource);
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
              </tr>
            </thead>
            <tbody>
              {sorted.map(r => {
                const { method, path } = extractMethod(r.resource);
                const isActive = drawerEndpoint === r.resource;
                return (
                  <tr
                    key={r.resource}
                    onClick={() => handleEndpointClick(r.resource)}
                    className={`border-b border-white/5 cursor-pointer transition-colors ${
                      isActive ? 'bg-primary/10' : 'hover:bg-white/5'
                    }`}
                  >
                    <td className="py-3 px-1">
                      <div className="flex items-center gap-2">
                        {method && (
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${methodColors[method] || 'bg-gray-500/20 text-gray-400'}`}>
                            {method}
                          </span>
                        )}
                        <span className="font-mono text-xs text-gray-200 truncate">{path}</span>
                      </div>
                    </td>
                    <td className="py-3 text-right font-mono text-xs">{formatNum(r.requests)}</td>
                    <td className="py-3 text-right font-mono text-xs text-red-400">{formatNum(r.errors)}</td>
                    <td className="py-3 text-right">
                      <span className={`text-xs font-bold ${r.error_rate < 5 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {r.error_rate.toFixed(1)}%
                      </span>
                    </td>
                    <td className={`py-3 text-right font-mono text-xs ${
                      r.avg_duration_ms >= 500 ? 'text-red-400' : r.avg_duration_ms >= 100 ? 'text-amber-400' : 'text-gray-200'
                    }`}>
                      {r.avg_duration_ms.toFixed(1)}ms
                    </td>
                    <td className="py-3 text-right font-mono text-xs text-amber-400">{r.p95_duration_ms.toFixed(1)}ms</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Span Drawer */}
      <SpanDrawer
        isOpen={drawerEndpoint !== null}
        onClose={() => setDrawerEndpoint(null)}
        serviceName={serviceName}
        resource={drawerEndpoint || ''}
        traces={traces}
        loadingTraces={loadingTraces}
      />
    </div>
  );
}
