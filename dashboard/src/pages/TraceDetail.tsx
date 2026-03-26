import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { fetchTrace, fetchLogs, type SpanResponse, type LogLineResponse } from '../lib/api';
import { SpanWaterfall } from '../components/traces/SpanWaterfall';
import { LogViewer } from '../components/logs/LogViewer';
import { ArrowLeft, X, AlertCircle, Clock, Hash } from 'lucide-react';

// Consistent color palette for services
const SERVICE_COLORS = [
  '#6366f1', '#8b5cf6', '#a855f7', '#ec4899', '#f43f5e',
  '#f97316', '#eab308', '#22c55e', '#14b8a6', '#06b6d4',
  '#3b82f6', '#6d28d9',
];

function getServiceColor(service: string, services: string[]): string {
  const idx = services.indexOf(service);
  return SERVICE_COLORS[idx >= 0 ? idx % SERVICE_COLORS.length : 0];
}

export function TraceDetail() {
  const { traceId } = useParams<{ traceId: string }>();
  const [spans, setSpans] = useState<SpanResponse[]>([]);
  const [logs, setLogs] = useState<LogLineResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeSpan, setActiveSpan] = useState<SpanResponse | null>(null);
  const [showMetadata, setShowMetadata] = useState(false);
  const [expandedLogIndices, setExpandedLogIndices] = useState<Set<number>>(new Set());

  const handleToggleLog = (index: number) => {
    setExpandedLogIndices(prev => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  useEffect(() => {
    if (!traceId) return;
    let active = true;
    const load = async () => {
      setLoading(true);
      const [fetchedSpans, fetchedLogs] = await Promise.all([
        fetchTrace(traceId).catch(() => []),
        fetchLogs('now-1h', 'now', traceId).catch(() => [])
      ]);
      if (active) {
        setSpans(fetchedSpans);
        setLogs(fetchedLogs);
        setLoading(false);
      }
    };
    load();
    return () => { active = false; };
  }, [traceId]);

  if (loading) {
    return <div className="flex-1 flex items-center justify-center text-text-muted bg-background">Loading trace data...</div>;
  }

  const uniqueServices = [...new Set(spans.map(s => s.service))];
  const rootSpan = spans.find(s => !s.parent_id) || spans[0];
  const totalDuration = rootSpan ? rootSpan.duration_ms : Math.max(...spans.map(s => s.duration_ms));
  const hasErrors = spans.some(s => s.error > 0);

  const filteredLogs = activeSpan 
    ? logs.filter(log => log.service === activeSpan.service || log.trace_id === activeSpan.trace_id)
    : logs;

  const handleSpanClick = (span: SpanResponse) => {
    setActiveSpan(span);
    setShowMetadata(true);
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-background text-text-primary overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-border bg-surface flex items-center gap-4 flex-shrink-0 z-20 shadow-sm">
        <Link to="/traces" className="p-2 hover:bg-surface-light rounded-lg text-text-secondary hover:text-text-primary transition-colors">
          <ArrowLeft size={20} />
        </Link>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-text-primary tracking-tight flex items-center gap-3">
            Trace View
            <span className="text-sm font-normal text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/20">{traceId}</span>
            {hasErrors && (
              <span className="text-sm font-bold text-red-400 bg-red-500/10 px-2 py-0.5 rounded border border-red-500/20 flex items-center gap-1">
                <AlertCircle size={12} /> ERROR
              </span>
            )}
          </h1>
          <div className="flex items-center gap-4 mt-1 text-xs text-text-muted">
            <span>{spans.length} spans</span>
            <span>{rootSpan?.service}</span>
            <span>{rootSpan?.name}</span>
            <span>{totalDuration.toFixed(1)}ms total</span>
            <span>{rootSpan?.timestamp}</span>
          </div>
        </div>

        {/* Service Legend */}
        <div className="flex gap-2 flex-wrap">
          {uniqueServices.map(svc => (
            <span key={svc} className="flex items-center gap-1 text-xs text-text-secondary">
              <span className="w-2 h-2 rounded-full" style={{ background: getServiceColor(svc, uniqueServices) }} />
              {svc}
            </span>
          ))}
        </div>
      </div>

      {/* Body: Waterfall + Optional Metadata Panel */}
      <div className="flex-1 flex overflow-hidden">
        {/* Waterfall Pane */}
        <div className={`${showMetadata ? 'w-2/3' : 'w-full'} h-[60vh] border-b border-border bg-background relative transition-all`}>
          <SpanWaterfall 
            spans={spans} 
            onSpanClick={handleSpanClick} 
            activeSpanId={activeSpan?.span_id} 
          />
        </div>

        {/* Metadata Panel */}
        {showMetadata && activeSpan && (
          <div className="w-1/3 h-[60vh] border-l border-border bg-surface overflow-auto animate-in slide-in-from-right duration-200">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-surface sticky top-0 z-10">
              <h3 className="font-bold text-sm text-text-primary">Span Details</h3>
              <button onClick={() => setShowMetadata(false)} className="p-1 hover:bg-surface-light rounded text-text-secondary hover:text-text-primary">
                <X size={16} />
              </button>
            </div>
            <div className="p-4 space-y-4 text-sm">
              {/* Error Banner */}
              {activeSpan.error > 0 && (
                <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 flex items-center gap-2 text-red-400">
                  <AlertCircle size={16} />
                  <span className="font-bold">This span has errors</span>
                </div>
              )}

              <DetailRow icon={<Hash size={14} />} label="Span ID" value={activeSpan.span_id} />
              <DetailRow icon={<Hash size={14} />} label="Parent ID" value={activeSpan.parent_id || 'Root Span'} />
              <DetailRow label="Service" value={activeSpan.service} color={getServiceColor(activeSpan.service, uniqueServices)} />
              <DetailRow label="Name" value={activeSpan.name} />
              <DetailRow label="Resource" value={activeSpan.resource || 'N/A'} />
              <DetailRow icon={<Clock size={14} />} label="Duration" value={`${activeSpan.duration_ms.toFixed(2)} ms`} />
              <DetailRow label="Start Time" value={activeSpan.timestamp} />
              <DetailRow label="Error" value={activeSpan.error > 0 ? 'Yes' : 'No'} />
            </div>
          </div>
        )}
      </div>

      {/* Logs Pane */}
      <div className="h-[40vh] flex flex-col bg-black relative shadow-[inset_0_10px_20px_rgba(0,0,0,0.5)]">
        <div className="px-4 py-2 border-b border-border bg-surface flex items-center justify-between text-xs font-semibold text-text-secondary tracking-wider">
          <span>Correlated Logs {activeSpan ? `for ${activeSpan.service}` : `for entire trace`} ({filteredLogs.length})</span>
          {activeSpan && (
            <button 
              onClick={() => { setActiveSpan(null); setShowMetadata(false); }}
              className="px-2 py-1 hover:bg-surface-light rounded text-text-primary uppercase tracking-widest text-[10px]"
            >
              Clear Filter
            </button>
          )}
        </div>
        <div className="flex-1 overflow-hidden">
          <LogViewer 
            logs={filteredLogs} 
            expandedLogIndices={expandedLogIndices}
            onToggleLog={handleToggleLog}
          />
        </div>
      </div>
    </div>
  );
}

function DetailRow({ icon, label, value, color }: { icon?: React.ReactNode; label: string; value: string; color?: string }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-text-muted text-xs uppercase tracking-wider flex items-center gap-1">
        {icon} {label}
      </span>
      <span className="font-mono text-text-primary break-all" style={color ? { color } : undefined}>
        {value}
      </span>
    </div>
  );
}
export default TraceDetail;
