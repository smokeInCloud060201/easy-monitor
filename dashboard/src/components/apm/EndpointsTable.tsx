import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Activity, ChevronRight, ChevronDown, ChevronUp } from 'lucide-react';
import type { ResourceWithMetrics } from '../../lib/api';

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

function extractMethod(resource: string): { method: string | null; path: string } {
  const methods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'];
  for (const m of methods) {
    if (resource.startsWith(`${m} `)) return { method: m, path: resource.slice(m.length + 1) };
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
  const navigate = useNavigate();
  const [sortKey, setSortKey] = useState<SortKey>('requests');
  const [sortAsc, setSortAsc] = useState(false);

  const sorted = useMemo(() => {
    const arr = [...resources];
    arr.sort((a, b) => {
      const va = a[sortKey] as number;
      const vb = b[sortKey] as number;
      if (typeof va === 'string') return sortAsc ? (va as string).localeCompare(vb as string) : (vb as string).localeCompare(va as string);
      return sortAsc ? va - vb : vb - va;
    });
    return arr;
  }, [resources, sortKey, sortAsc]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc(!sortAsc);
    else { setSortKey(key); setSortAsc(false); }
  };

  const SortIcon = ({ col }: { col: SortKey }) => {
    if (sortKey !== col) return null;
    return sortAsc ? <ChevronUp size={12} /> : <ChevronDown size={12} />;
  };

  return (
    <div className="glass-panel p-4 shadow-xl">
      <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4 flex items-center gap-2">
        <Activity className="w-4 h-4 text-primary" /> Endpoints / Resources
        <span className="bg-white/10 text-gray-400 text-xs px-2 py-0.5 rounded-full ml-2">{resources.length}</span>
      </h3>

      {resources.length === 0 ? (
        <p className="text-gray-500 text-center py-8 text-sm">No endpoint data available yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-400 border-b border-white/10">
                <th className="pb-3 font-semibold cursor-pointer hover:text-white" onClick={() => handleSort('resource')}>
                  <span className="flex items-center gap-1">Resource <SortIcon col="resource" /></span>
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
                return (
                  <tr
                    key={r.resource}
                    onClick={() => navigate(`/apm/services/${serviceName}/resources/${encodeURIComponent(r.resource)}`)}
                    className="border-b border-white/5 hover:bg-white/5 cursor-pointer transition-colors group"
                  >
                    <td className="py-3 group-hover:text-primary transition-colors">
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
                      <div className="flex items-center justify-end gap-2">
                        <div className="w-16 h-1.5 bg-black/40 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${r.error_rate < 5 ? 'bg-emerald-500' : 'bg-red-500'}`}
                            style={{ width: `${Math.min(r.error_rate, 100)}%` }}
                          />
                        </div>
                        <span className={`text-xs font-bold ${r.error_rate < 5 ? 'text-emerald-400' : 'text-red-400'}`}>
                          {r.error_rate.toFixed(1)}%
                        </span>
                      </div>
                    </td>
                    <td className={`py-3 text-right font-mono text-xs ${
                      r.avg_duration_ms >= 500 ? 'text-red-400' : r.avg_duration_ms >= 100 ? 'text-amber-400' : 'text-gray-200'
                    }`}>
                      {r.avg_duration_ms.toFixed(1)}ms
                    </td>
                    <td className="py-3 text-right font-mono text-xs text-amber-400">{r.p95_duration_ms.toFixed(1)}ms</td>
                    <td className="py-3"><ChevronRight className="w-4 h-4 text-gray-600 group-hover:text-primary" /></td>
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
