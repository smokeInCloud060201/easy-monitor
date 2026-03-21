import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Loader2, Server, Activity, ChevronRight } from 'lucide-react';
import { fetchServices, fetchResourcesWithMetrics, type ResourceWithMetrics } from '../lib/api';
import axios from 'axios';

const API_BASE = 'http://localhost:3000/api/v1';

interface Metrics {
  rate: number;
  error_count: number;
  duration_sum: number;
}

function ServiceCard({ service }: { service: string }) {
  const [metrics, setMetrics] = useState<Metrics | null>(null);

  useEffect(() => {
    axios.get(`${API_BASE}/apm/services/${service}/resources`)
      .then(res => {
         const resources: ResourceWithMetrics[] = res.data.resources || [];
         if (resources.length > 0) {
           let rate = 0; let error = 0; let duration = 0;
           resources.forEach(r => {
             rate += r.requests;
             error += r.errors;
             duration += r.avg_duration_ms * r.requests;
           });
           setMetrics({ rate, error_count: error, duration_sum: duration });
         } else {
           // Fallback to old metrics query
           axios.get(`${API_BASE}/apm/services/${service}/resources`)
             .then(res2 => {
                const resNames = res2.data.resources?.map((r: any) => r.resource || r) || [];
                if (resNames.length > 0) {
                  Promise.all(resNames.map((r: string) => axios.post(`${API_BASE}/metrics/query`, { service, resource: r })))
                    .then(responses => {
                       let r2 = 0; let e2 = 0; let d2 = 0;
                       responses.forEach(resp => {
                         r2 += resp.data.rate;
                         e2 += resp.data.error_count;
                         d2 += resp.data.duration_sum;
                       });
                       setMetrics({ rate: r2, error_count: e2, duration_sum: d2 });
                    })
                    .catch(() => setMetrics({ rate: 0, error_count: 0, duration_sum: 0 }));
                } else {
                  setMetrics({ rate: 0, error_count: 0, duration_sum: 0 });
                }
             })
             .catch(() => setMetrics({ rate: 0, error_count: 0, duration_sum: 0 }));
         }
      })
      .catch(() => setMetrics({ rate: 0, error_count: 0, duration_sum: 0 }));
  }, [service]);

  if (!metrics) {
    return (
      <div className="glass-panel p-6 flex flex-col items-center justify-center min-h-[200px] animate-pulse">
        <Loader2 className="w-8 h-8 animate-spin text-primary opacity-50" />
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
            <Server className="w-5 h-5 text-gray-400 group-hover:text-primary transition-colors" />
            <h3 className="text-xl font-bold">{service}</h3>
          </div>
          <div className="flex items-center gap-2">
            {!isHealthy && <Activity className="w-5 h-5 text-danger animate-pulse" />}
            <ChevronRight className="w-5 h-5 text-gray-600 group-hover:text-primary transition-colors" />
          </div>
        </div>
        
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-gray-400 text-sm mb-1">Reqs / sec</p>
            <p className="text-2xl font-mono text-gray-100">{metrics.rate.toFixed(1)}</p>
          </div>
          <div>
            <p className="text-gray-400 text-sm mb-1">Avg Latency</p>
            <p className="text-2xl font-mono text-gray-100">{avgLatency.toFixed(2)} ms</p>
          </div>
          <div className="col-span-2 mt-2">
            <p className="text-gray-400 text-sm mb-1">Error Rate ({errorRate.toFixed(1)}%)</p>
            <div className="flex items-center gap-2">
              <div className="flex-1 h-2 bg-black/40 rounded-full overflow-hidden shadow-inner">
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
}

export default function APMCatalog() {
  const [services, setServices] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchServices()
      .then(s => { setServices(s); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex justify-between items-end mb-8">
        <div>
          <h1 className="text-4xl font-extrabold tracking-tight mb-2">Service Catalog</h1>
          <p className="text-gray-400">Real-time RED metrics driven by distributed trace analysis. Click a service to drill down.</p>
        </div>
        <div className="flex gap-2 items-center">
          <Link to="/traces" className="text-sm text-brand-light hover:underline">View all traces →</Link>
          <span className="px-3 py-1 glass-panel border-primary/20 text-sm text-gray-300 font-mono shadow-md">Total Active: {services.length}</span>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center items-center h-64">
           <Loader2 className="w-10 h-10 animate-spin text-primary" />
        </div>
      ) : services.length === 0 ? (
        <div className="glass-panel p-12 text-center border-dashed border-2 border-white/10 bg-transparent">
          <Server className="w-12 h-12 text-gray-600 mx-auto mb-4" />
          <h3 className="text-xl font-bold mb-2 text-gray-300">No telemetry indexed</h3>
          <p className="text-gray-500">Ensure application spans are being sent to the APM ingestion endpoint.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {services.map(s => <ServiceCard key={s} service={s} />)}
        </div>
      )}
    </div>
  );
}
