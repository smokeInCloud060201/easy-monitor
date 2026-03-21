import { Link } from 'react-router-dom';
import { ArrowRight, Server, Database, Zap } from 'lucide-react';
import type { ServiceDependencies } from '../../lib/api';

interface DependencyMiniMapProps {
  data: ServiceDependencies;
  currentService: string;
  healthStatus: 'healthy' | 'degraded';
}

function nodeIcon(name: string) {
  const n = name.toLowerCase();
  if (n.includes('db') || n.includes('postgres') || n.includes('mysql') || n.includes('mongo')) return <Database size={14} />;
  if (n.includes('cache') || n.includes('redis')) return <Zap size={14} />;
  return <Server size={14} />;
}

export function DependencyMiniMap({ data, currentService, healthStatus }: DependencyMiniMapProps) {
  return (
    <div className="glass-panel p-4 shadow-xl">
      <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4">Dependencies</h3>

      <div className="flex items-center gap-4 min-h-[120px]">
        {/* Upstream */}
        <div className="flex-1 flex flex-col gap-2 items-end">
          {data.upstream.length === 0 ? (
            <span className="text-gray-600 text-xs">No upstream</span>
          ) : (
            data.upstream.map(dep => (
              <Link
                key={dep.service}
                to={`/apm/services/${encodeURIComponent(dep.service)}`}
                className="flex items-center gap-2 bg-white/5 hover:bg-white/10 rounded-lg px-3 py-2 transition-colors w-full max-w-[200px]"
              >
                <span className="text-gray-500">{nodeIcon(dep.service)}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-gray-200 truncate font-medium">{dep.service}</div>
                  <div className="text-[10px] text-gray-500">{Math.round(dep.requests)} req</div>
                </div>
                {dep.error_rate > 5 && (
                  <span className="text-[9px] text-red-400 font-bold">{dep.error_rate.toFixed(0)}%</span>
                )}
              </Link>
            ))
          )}
        </div>

        {/* Arrows → Current Service → Arrows */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <ArrowRight size={14} className="text-gray-600" />
          <div className={`w-16 h-16 rounded-full flex items-center justify-center border-2 ${
            healthStatus === 'healthy' ? 'border-emerald-500 shadow-emerald-500/20' : 'border-red-500 shadow-red-500/20'
          } bg-gray-800 shadow-lg`}>
            <Server size={20} className="text-gray-300" />
          </div>
          <ArrowRight size={14} className="text-gray-600" />
        </div>

        {/* Downstream */}
        <div className="flex-1 flex flex-col gap-2">
          {data.downstream.length === 0 ? (
            <span className="text-gray-600 text-xs">No downstream</span>
          ) : (
            data.downstream.map(dep => (
              <Link
                key={dep.service}
                to={`/apm/services/${encodeURIComponent(dep.service)}`}
                className="flex items-center gap-2 bg-white/5 hover:bg-white/10 rounded-lg px-3 py-2 transition-colors w-full max-w-[200px]"
              >
                <span className="text-gray-500">{nodeIcon(dep.service)}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-gray-200 truncate font-medium">{dep.service}</div>
                  <div className="text-[10px] text-gray-500">{Math.round(dep.requests)} req · {dep.avg_duration_ms.toFixed(0)}ms</div>
                </div>
                {dep.error_rate > 5 && (
                  <span className="text-[9px] text-red-400 font-bold">{dep.error_rate.toFixed(0)}%</span>
                )}
              </Link>
            ))
          )}
        </div>
      </div>

      {/* Center label */}
      <div className="text-center mt-2 text-xs text-gray-500">{currentService}</div>
    </div>
  );
}
