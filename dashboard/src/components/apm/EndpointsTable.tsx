import { useState, useMemo } from 'react';
import { Activity, ChevronDown, ChevronUp } from 'lucide-react';
import type { ResourceWithMetrics } from '../../lib/api';
import { EndpointDrawer } from './EndpointDrawer';

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

  const handleEndpointClick = (resource: string) => {
    setDrawerEndpoint(drawerEndpoint === resource ? null : resource);
  };



  return (
    <div className="glass-panel p-4 shadow-xl">
      <h3 className="text-sm font-bold text-text-secondary uppercase tracking-wider mb-4 flex items-center gap-2">
        <Activity className="w-4 h-4 text-primary" /> Endpoints
        <span className="bg-surface-light text-text-secondary text-xs px-2 py-0.5 rounded-full ml-2">{apiEndpoints.length}</span>
      </h3>

      {apiEndpoints.length === 0 ? (
        <p className="text-text-muted text-center py-8 text-sm">No endpoint data available yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-text-secondary border-b border-border">
                <th className="pb-3 font-semibold cursor-pointer hover:text-text-primary" onClick={() => handleSort('resource')}>
                  <span className="flex items-center gap-1">Endpoint <SortIcon col="resource" sortKey={sortKey} sortAsc={sortAsc} /></span>
                </th>
                <th className="pb-3 font-semibold text-right cursor-pointer hover:text-text-primary" onClick={() => handleSort('requests')}>
                  <span className="flex items-center justify-end gap-1">Requests <SortIcon col="requests" sortKey={sortKey} sortAsc={sortAsc} /></span>
                </th>
                <th className="pb-3 font-semibold text-right cursor-pointer hover:text-text-primary" onClick={() => handleSort('errors')}>
                  <span className="flex items-center justify-end gap-1">Errors <SortIcon col="errors" sortKey={sortKey} sortAsc={sortAsc} /></span>
                </th>
                <th className="pb-3 font-semibold text-right cursor-pointer hover:text-text-primary" onClick={() => handleSort('error_rate')}>
                  <span className="flex items-center justify-end gap-1">Error Rate <SortIcon col="error_rate" sortKey={sortKey} sortAsc={sortAsc} /></span>
                </th>
                <th className="pb-3 font-semibold text-right cursor-pointer hover:text-text-primary" onClick={() => handleSort('avg_duration_ms')}>
                  <span className="flex items-center justify-end gap-1">Avg Latency <SortIcon col="avg_duration_ms" sortKey={sortKey} sortAsc={sortAsc} /></span>
                </th>
                <th className="pb-3 font-semibold text-right cursor-pointer hover:text-text-primary" onClick={() => handleSort('p95_duration_ms')}>
                  <span className="flex items-center justify-end gap-1">P95 <SortIcon col="p95_duration_ms" sortKey={sortKey} sortAsc={sortAsc} /></span>
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
                    className={`border-b border-border cursor-pointer transition-colors ${
                      isActive ? 'bg-primary/10' : 'hover:bg-surface-light'
                    }`}
                  >
                    <td className="py-3 px-1">
                      <div className="flex items-center gap-2">
                        {method && (
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${methodColors[method] || 'bg-surface-light text-text-secondary'}`}>
                            {method}
                          </span>
                        )}
                        <span className="font-mono text-xs text-text-primary truncate">{path}</span>
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
                      r.avg_duration_ms >= 500 ? 'text-red-400' : r.avg_duration_ms >= 100 ? 'text-amber-400' : 'text-text-primary'
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

      {/* Endpoint Drawer (Level 1) */}
      <EndpointDrawer
        isOpen={drawerEndpoint !== null}
        onClose={() => setDrawerEndpoint(null)}
        serviceName={serviceName}
        resource={drawerEndpoint || ''}
        resourceMetrics={resources.find(r => r.resource === drawerEndpoint) || null}
      />
    </div>
  );
}

function SortIcon({ col, sortKey, sortAsc }: { col: SortKey; sortKey: SortKey; sortAsc: boolean }) {
  if (sortKey !== col) return null;
  return sortAsc ? <ChevronUp size={12} /> : <ChevronDown size={12} />;
}
