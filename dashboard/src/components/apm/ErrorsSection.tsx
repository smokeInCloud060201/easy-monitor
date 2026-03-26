import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { AlertTriangle } from 'lucide-react';

interface ErrorEntry {
  name: string;
  resource: string;
  count: number;
  last_seen: string;
}

interface TimePoint {
  time: string;
  errors: number;
}

interface ErrorsSectionProps {
  errors: ErrorEntry[];
  timeseries: TimePoint[];
  totalErrors: number;
  errorRate: number;
}

export function ErrorsSection({ errors, timeseries, totalErrors, errorRate }: ErrorsSectionProps) {
  return (
    <div className="glass-panel p-4 shadow-xl">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-bold text-text-secondary uppercase tracking-wider flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-red-400" /> Error Tracking
        </h3>
        <div className="flex items-center gap-3">
          <span className="bg-red-500/10 text-red-400 text-xs font-bold px-2 py-0.5 rounded">
            {totalErrors} errors
          </span>
          <span className={`text-xs font-bold px-2 py-0.5 rounded ${errorRate > 5 ? 'bg-red-500/10 text-red-400' : 'bg-emerald-500/10 text-emerald-400'}`}>
            {errorRate.toFixed(1)}% rate
          </span>
        </div>
      </div>

      {/* Error Rate Mini Chart */}
      {timeseries.length > 0 && (
        <div className="mb-4">
          <ResponsiveContainer width="100%" height={80}>
            <AreaChart data={timeseries}>
              <defs>
                <linearGradient id="errGradSection" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="time" tick={{ fill: '#64748b', fontSize: 9 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#64748b', fontSize: 9 }} axisLine={false} tickLine={false} width={30} />
              <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 8, fontSize: 11 }} />
              <Area type="monotone" dataKey="errors" stroke="#ef4444" fill="url(#errGradSection)" strokeWidth={1.5} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Top Errors List */}
      {errors.length === 0 ? (
        <p className="text-text-muted text-center py-4 text-sm">No errors detected — looking good! 🎉</p>
      ) : (
        <div className="space-y-1">
          {errors.slice(0, 5).map((err, i) => (
            <div key={i} className="flex items-center gap-3 p-2 rounded-lg hover:bg-surface-light transition-colors text-sm">
              <span className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0" />
              <span className="text-text-primary flex-1 truncate font-mono text-xs">{err.name}</span>
              <span className="text-text-muted text-xs truncate max-w-[120px]">{err.resource}</span>
              <span className="bg-red-500/10 text-red-400 text-xs font-bold px-2 py-0.5 rounded tabular-nums">
                ×{err.count}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
