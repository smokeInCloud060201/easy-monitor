import { useEffect, useState, memo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Loader2, Server, Activity, ChevronRight, LayoutList } from 'lucide-react';
import { fetchServices, fetchResourcesWithMetrics, type ResourceWithMetrics } from '../lib/api';

interface Metrics {
  rate: number;
  error_count: number;
  duration_sum: number;
}

const ServiceRow = memo(function ServiceRow({ service }: { service: string }) {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    fetchResourcesWithMetrics(service)
      .then((resources: ResourceWithMetrics[]) => {
        if (resources.length > 0) {
          let rate = 0; let error = 0; let duration = 0;
          resources.forEach(r => {
            rate += r.requests;
            error += r.errors;
            duration += r.avg_duration_ms * r.requests;
          });
          setMetrics({ rate, error_count: error, duration_sum: duration });
        } else {
          setMetrics({ rate: 0, error_count: 0, duration_sum: 0 });
        }
      })
      .catch(() => setMetrics({ rate: 0, error_count: 0, duration_sum: 0 }));
  }, [service]);

  if (!metrics) {
    return (
      <tr className="animate-pulse border-b border-border">
        <td className="px-4 py-4">
          <div className="flex items-center gap-3 pl-2">
            <Server className="w-4 h-4 text-brand-light opacity-50" />
            <div className="h-4 bg-surface-light rounded w-32"></div>
          </div>
        </td>
        <td className="px-4 py-4"><div className="h-4 bg-surface-light rounded w-16"></div></td>
        <td className="px-4 py-4"><div className="h-4 bg-surface-light rounded w-16"></div></td>
        <td className="px-4 py-4"><div className="h-4 bg-surface-light rounded w-32"></div></td>
        <td className="px-4 py-4"></td>
      </tr>
    );
  }

  const errorRate = metrics.rate > 0 ? (metrics.error_count / metrics.rate) * 100 : 0;
  const avgLatency = metrics.rate > 0 ? (metrics.duration_sum / metrics.rate) : 0;
  const isHealthy = errorRate < 5;

  return (
    <tr 
      onClick={() => navigate(`/apm/services/${service}`)}
      className="group cursor-pointer hover:bg-surface-light border-b border-border transition-colors relative"
    >
      <td className="px-4 py-4 relative">
        <div className={`absolute left-0 top-0 bottom-0 w-[3px] ${isHealthy ? 'bg-success' : 'bg-danger'}`} />
        <div className="flex items-center gap-3 pl-3">
          <Server className="w-4 h-4 text-text-secondary group-hover:text-primary transition-colors" />
          <span className="font-bold text-[13px] text-text-primary group-hover:text-primary transition-colors">{service}</span>
        </div>
      </td>
      <td className="px-4 py-4 font-mono tabular-nums text-text-primary text-[13px]">
        {metrics.rate.toFixed(1)} <span className="text-text-muted text-[10px] uppercase font-sans tracking-wider ml-1">r/s</span>
      </td>
      <td className="px-4 py-4 font-mono tabular-nums text-[13px] text-text-primary">
        <span className={avgLatency > 500 ? 'text-amber-400' : ''}>{avgLatency.toFixed(2)} ms</span>
      </td>
      <td className="px-4 py-4 w-64">
        <div className="flex items-center gap-3">
          <span className={`font-mono tabular-nums text-[13px] w-12 ${errorRate > 5 ? 'text-red-400' : 'text-text-primary'}`}>
            {errorRate.toFixed(1)}%
          </span>
          <div className="flex-1 h-1.5 bg-surface-light rounded-full overflow-hidden">
            <div 
              className={`h-full transition-all duration-1000 ${isHealthy ? 'bg-success' : 'bg-danger'}`} 
              style={{ width: `${Math.min(errorRate, 100)}%` }}
            />
          </div>
          {!isHealthy && <Activity className="w-3.5 h-3.5 text-danger animate-pulse flex-shrink-0" />}
        </div>
      </td>
      <td className="px-4 py-4 text-right pr-6">
        <ChevronRight className="w-4 h-4 text-text-muted group-hover:text-primary transition-colors inline-block" />
      </td>
    </tr>
  );
});

export default function APMCatalog() {
  const [services, setServices] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchServices()
      .then(s => { setServices(s); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  return (
    <div className="page-container">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="page-title flex items-center gap-2">
            <LayoutList className="w-5 h-5 text-text-secondary" />
            Service Catalog
          </h1>
          <p className="text-[13px] text-text-secondary mt-1">Real-time RED metrics driven by distributed trace analysis.</p>
        </div>
        <div className="flex gap-3 items-center">
          <Link to="/traces" className="text-[13px] text-primary dark:text-brand-light hover:underline font-medium">View all traces →</Link>
          <span className="badge badge-info bg-surface font-mono border-border text-text-primary">Active: {services.length}</span>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center items-center h-64">
           <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      ) : services.length === 0 ? (
        <div className="glass-panel p-12 text-center border-dashed border-2 border-border bg-transparent">
          <Server className="w-10 h-10 text-text-muted mx-auto mb-3" />
          <h3 className="text-sm font-semibold mb-1 text-text-primary">No telemetry indexed</h3>
          <p className="text-[11px] text-text-muted">Ensure application spans are being sent to the APM ingestion endpoint.</p>
        </div>
      ) : (
        <div className="glass-panel overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-surface border-b border-border">
                <th className="px-4 py-3 text-[11px] font-semibold text-text-muted uppercase tracking-wider pl-8">Service Name</th>
                <th className="px-4 py-3 text-[11px] font-semibold text-text-muted uppercase tracking-wider">Requests Rate</th>
                <th className="px-4 py-3 text-[11px] font-semibold text-text-muted uppercase tracking-wider">Avg Latency</th>
                <th className="px-4 py-3 text-[11px] font-semibold text-text-muted uppercase tracking-wider">Error Rate</th>
                <th className="px-4 py-3 w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {services.map(s => <ServiceRow key={s} service={s} />)}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
