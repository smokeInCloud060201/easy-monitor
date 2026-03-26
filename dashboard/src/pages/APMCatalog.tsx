import { useEffect, useState, memo } from 'react';
import { Link } from 'react-router-dom';
import { Loader2, Server, Activity, ChevronRight } from 'lucide-react';
import { fetchServices, fetchResourcesWithMetrics, type ResourceWithMetrics } from '../lib/api';

interface Metrics {
  rate: number;
  error_count: number;
  duration_sum: number;
}

const ServiceCard = memo(function ServiceCard({ service }: { service: string }) {
  const [metrics, setMetrics] = useState<Metrics | null>(null);

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
      <div className="glass-panel p-6 flex flex-col items-center justify-center min-h-[200px] animate-pulse">
        <Loader2 className="w-6 h-6 animate-spin text-brand-light opacity-50" />
      </div>
    );
  }

  const errorRate = metrics.rate > 0 ? (metrics.error_count / metrics.rate) * 100 : 0;
  const avgLatency = metrics.rate > 0 ? (metrics.duration_sum / metrics.rate) : 0;
  const isHealthy = errorRate < 5;

  return (
    <Link to={`/apm/services/${service}`} className="block">
      <div className="glass-panel-hover p-6 cursor-pointer group relative overflow-hidden">
        <div className={`absolute top-0 w-full left-0 h-1 ${isHealthy ? 'bg-success' : 'bg-danger'}`} />
        
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Server className="w-5 h-5 text-text-secondary group-hover:text-brand-light transition-colors" />
            <h3 className="text-sm font-bold">{service}</h3>
          </div>
          <div className="flex items-center gap-2">
            {!isHealthy && <Activity className="w-4 h-4 text-danger animate-pulse" />}
            <ChevronRight className="w-4 h-4 text-text-muted group-hover:text-brand-light transition-colors" />
          </div>
        </div>
        
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-text-muted text-[11px] uppercase tracking-wider mb-1">Reqs / sec</p>
            <p className="text-lg font-mono tabular-nums text-text-primary">{metrics.rate.toFixed(1)}</p>
          </div>
          <div>
            <p className="text-text-muted text-[11px] uppercase tracking-wider mb-1">Avg Latency</p>
            <p className="text-lg font-mono tabular-nums text-text-primary">{avgLatency.toFixed(2)} ms</p>
          </div>
          <div className="col-span-2 mt-2">
            <p className="text-text-muted text-[11px] uppercase tracking-wider mb-1">Error Rate ({errorRate.toFixed(1)}%)</p>
            <div className="flex items-center gap-2">
              <div className="flex-1 h-2 bg-surface-light rounded-full overflow-hidden shadow-inner">
                <div 
                  className={`h-full transition-all duration-1000 ${isHealthy ? 'bg-success' : 'bg-danger'}`} 
                  style={{ width: `${Math.min(errorRate, 100)}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </Link>
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
          <h1 className="page-title">Service Catalog</h1>
          <p className="text-[13px] text-text-secondary mt-1">Real-time RED metrics driven by distributed trace analysis.</p>
        </div>
        <div className="flex gap-3 items-center">
          <Link to="/traces" className="text-[13px] text-brand-light hover:underline">View all traces →</Link>
          <span className="badge badge-info font-mono">Active: {services.length}</span>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center items-center h-64">
           <Loader2 className="w-6 h-6 animate-spin text-brand-light" />
        </div>
      ) : services.length === 0 ? (
        <div className="glass-panel p-12 text-center border-dashed border-2 border-border bg-transparent">
          <Server className="w-10 h-10 text-text-muted mx-auto mb-3" />
          <h3 className="text-sm font-semibold mb-1 text-text-primary">No telemetry indexed</h3>
          <p className="text-[11px] text-text-muted">Ensure application spans are being sent to the APM ingestion endpoint.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {services.map(s => <ServiceCard key={s} service={s} />)}
        </div>
      )}
    </div>
  );
}
