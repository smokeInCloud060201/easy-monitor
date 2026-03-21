import { Link } from 'react-router-dom';
import { X, ExternalLink, ArrowDownRight, ArrowUpRight, Activity, AlertTriangle, Clock } from 'lucide-react';
import type { ServiceMapNode, ServiceMapEdge } from '../../lib/api';

interface ServiceNodeTooltipProps {
  node: ServiceMapNode | null;
  edges: ServiceMapEdge[];
  onClose: () => void;
  onNavigateToService: (service: string) => void;
}

const statusBadge: Record<string, string> = {
  healthy: 'bg-green-500/20 text-green-400 border-green-500/40',
  warning: 'bg-amber-500/20 text-amber-400 border-amber-500/40',
  error: 'bg-red-500/20 text-red-400 border-red-500/40',
};

export function ServiceNodeTooltip({ node, edges, onClose }: ServiceNodeTooltipProps) {
  if (!node) return null;

  const upstream = edges.filter(e => e.target === node.service);
  const downstream = edges.filter(e => e.source === node.service);

  return (
    <div className="w-80 bg-gray-900 border-l border-gray-700 flex flex-col overflow-y-auto animate-in slide-in-from-right duration-200">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-800 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-white">{node.service}</h3>
          <div className="flex items-center gap-2 mt-1">
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${statusBadge[node.status]}`}>
              {node.status.toUpperCase()}
            </span>
            <span className="text-[10px] text-gray-500">{node.node_type}</span>
          </div>
        </div>
        <button onClick={onClose} className="text-gray-500 hover:text-gray-300 transition-colors">
          <X size={16} />
        </button>
      </div>

      {/* RED Metrics */}
      <div className="px-4 py-3 border-b border-gray-800 grid grid-cols-2 gap-3">
        <div>
          <div className="flex items-center gap-1 text-[10px] text-gray-500 mb-1">
            <Activity size={10} /> Requests
          </div>
          <span className="text-lg font-bold text-white tabular-nums">
            {node.total_requests.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </span>
        </div>
        <div>
          <div className="flex items-center gap-1 text-[10px] text-gray-500 mb-1">
            <AlertTriangle size={10} /> Error Rate
          </div>
          <span className={`text-lg font-bold tabular-nums ${node.error_rate > 5 ? 'text-red-400' : 'text-white'}`}>
            {node.error_rate.toFixed(1)}%
          </span>
        </div>
        <div>
          <div className="flex items-center gap-1 text-[10px] text-gray-500 mb-1">
            <Clock size={10} /> Avg Duration
          </div>
          <span className={`text-lg font-bold tabular-nums ${node.avg_duration_ms > 500 ? 'text-amber-400' : 'text-white'}`}>
            {node.avg_duration_ms.toFixed(0)}ms
          </span>
        </div>
        <div>
          <div className="flex items-center gap-1 text-[10px] text-gray-500 mb-1">
            <Clock size={10} /> P95
          </div>
          <span className="text-lg font-bold text-white tabular-nums">
            {node.p95_duration_ms.toFixed(0)}ms
          </span>
        </div>
      </div>

      {/* Upstream */}
      {upstream.length > 0 && (
        <div className="px-4 py-3 border-b border-gray-800">
          <div className="flex items-center gap-1 text-[10px] text-gray-500 mb-2 uppercase tracking-wider font-semibold">
            <ArrowDownRight size={12} /> Upstream ({upstream.length})
          </div>
          <div className="space-y-1.5">
            {upstream.map(e => (
              <div key={e.source} className="flex items-center justify-between text-xs">
                <span className="text-blue-400">{e.source}</span>
                <div className="flex items-center gap-2 text-gray-500">
                  <span>{Math.round(e.requests)} req</span>
                  {e.error_rate > 0 && <span className="text-red-400">{e.error_rate.toFixed(1)}%</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Downstream */}
      {downstream.length > 0 && (
        <div className="px-4 py-3 border-b border-gray-800">
          <div className="flex items-center gap-1 text-[10px] text-gray-500 mb-2 uppercase tracking-wider font-semibold">
            <ArrowUpRight size={12} /> Downstream ({downstream.length})
          </div>
          <div className="space-y-1.5">
            {downstream.map(e => (
              <div key={e.target} className="flex items-center justify-between text-xs">
                <span className="text-emerald-400">{e.target}</span>
                <div className="flex items-center gap-2 text-gray-500">
                  <span>{Math.round(e.requests)} req</span>
                  {e.error_rate > 0 && <span className="text-red-400">{e.error_rate.toFixed(1)}%</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="px-4 py-3 space-y-2">
        <Link
          to={`/apm/services/${encodeURIComponent(node.service)}`}
          className="flex items-center gap-2 w-full text-xs bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 rounded-lg px-3 py-2 transition-colors"
        >
          <ExternalLink size={12} /> View Service Detail
        </Link>
        <Link
          to={`/traces`}
          className="flex items-center gap-2 w-full text-xs bg-gray-800 text-gray-300 hover:bg-gray-700 rounded-lg px-3 py-2 transition-colors"
        >
          <ExternalLink size={12} /> View Traces
        </Link>
        <Link
          to={`/logs`}
          className="flex items-center gap-2 w-full text-xs bg-gray-800 text-gray-300 hover:bg-gray-700 rounded-lg px-3 py-2 transition-colors"
        >
          <ExternalLink size={12} /> View Logs
        </Link>
      </div>
    </div>
  );
}
