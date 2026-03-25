import { useEffect, useState, useCallback } from 'react';
import { Zap, ChevronDown, ChevronRight, Loader2 } from 'lucide-react';
import { searchTraces, fetchTrace, type TraceSummary, type SpanResponse } from '../../lib/api';
import { SpanWaterfall } from '../traces/SpanWaterfall';

interface TracesSectionProps {
  serviceName: string;
  timeRange: string;
}

function timeAgo(timestamp: string): string {
  const now = Date.now();
  const then = new Date(timestamp).getTime();
  const diffSec = Math.floor((now - then) / 1000);
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  return `${Math.floor(diffHr / 24)}d ago`;
}

export function TracesSection({ serviceName, timeRange }: TracesSectionProps) {
  const PAGE_SIZE = 20;

  const [traces, setTraces] = useState<TraceSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const [expandedTraceId, setExpandedTraceId] = useState<string | null>(null);
  const [expandedSpans, setExpandedSpans] = useState<SpanResponse[]>([]);
  const [loadingSpans, setLoadingSpans] = useState(false);

  // Load initial traces
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setExpandedTraceId(null);
      setExpandedSpans([]);
      try {
        const r = await searchTraces({ service: serviceName, limit: PAGE_SIZE, offset: 0 });
        setTraces(r.traces);
        setTotal(r.total);
      } catch {
        setTraces([]);
        setTotal(0);
      }
      setLoading(false);
    };
    load();
  }, [serviceName, timeRange]);

  // Load more traces
  const loadMore = useCallback(() => {
    setLoadingMore(true);
    searchTraces({ service: serviceName, limit: PAGE_SIZE, offset: traces.length })
      .then(r => {
        setTraces(prev => [...prev, ...r.traces]);
        setTotal(r.total);
      })
      .finally(() => setLoadingMore(false));
  }, [serviceName, traces.length]);

  // Toggle trace expansion
  const toggleTrace = useCallback((traceId: string) => {
    if (expandedTraceId === traceId) {
      setExpandedTraceId(null);
      setExpandedSpans([]);
      return;
    }

    setExpandedTraceId(traceId);
    setLoadingSpans(true);
    setExpandedSpans([]);
    fetchTrace(traceId)
      .then(spans => setExpandedSpans(spans))
      .finally(() => setLoadingSpans(false));
  }, [expandedTraceId]);

  const hasMore = traces.length < total;
  const maxDuration = Math.max(...traces.map(t => t.duration_ms), 1);

  return (
    <div className="glass-panel p-4 shadow-xl">
      {/* Header */}
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
          <Zap className="w-4 h-4 text-amber-400" /> Traces
        </h3>
        <span className="text-xs text-gray-500">
          {total > 0 ? `${total} total` : ''}
        </span>
      </div>

      {/* Loading state */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-5 h-5 animate-spin text-gray-500" />
        </div>
      ) : traces.length === 0 ? (
        <p className="text-gray-500 text-center py-10 text-sm">No traces found for this service.</p>
      ) : (
        <>
          {/* Table header */}
          <div className="flex items-center gap-3 px-2.5 py-2 text-[10px] font-bold text-gray-500 uppercase tracking-wider border-b border-white/5">
            <span className="w-5" />
            <span className="w-3" />
            <span className="flex-1">Resource</span>
            <span className="w-24 text-center">Service</span>
            <span className="w-14 text-center">Spans</span>
            <span className="w-28">Duration</span>
            <span className="w-16 text-right">Time</span>
          </div>

          {/* Trace rows */}
          <div className="divide-y divide-white/[0.03]">
            {traces.map(t => {
              const isExpanded = expandedTraceId === t.trace_id;
              return (
                <div key={t.trace_id}>
                  {/* Trace row */}
                  <button
                    onClick={() => toggleTrace(t.trace_id)}
                    className={`flex items-center gap-3 w-full px-2.5 py-2.5 text-left rounded-lg transition-all duration-150 group ${
                      isExpanded
                        ? 'bg-white/[0.03] border-l-2 border-primary -ml-[2px] pl-[calc(0.625rem+2px)]'
                        : 'hover:bg-white/5'
                    }`}
                  >
                    {/* Expand icon */}
                    <span className="w-5 flex-shrink-0 text-gray-600 group-hover:text-gray-400 transition-colors">
                      {isExpanded
                        ? <ChevronDown size={14} />
                        : <ChevronRight size={14} />
                      }
                    </span>

                    {/* Status dot */}
                    <span className={`w-2 h-2 rounded-full flex-shrink-0 ${t.error ? 'bg-red-500' : 'bg-emerald-500'}`} />

                    {/* Resource name */}
                    <span className="flex-1 text-gray-200 text-xs font-medium truncate">
                      {t.root_name || 'unknown'}
                    </span>

                    {/* Service */}
                    <span className="w-24 text-center">
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-gray-400 font-mono truncate inline-block max-w-full">
                        {t.root_service}
                      </span>
                    </span>

                    {/* Span count */}
                    <span className="w-14 text-center text-gray-600 text-[10px]">{t.span_count} spans</span>

                    {/* Duration bar */}
                    <div className="w-28 flex items-center gap-1.5">
                      <div className="flex-1 h-1 bg-black/40 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${t.error ? 'bg-red-500' : 'bg-blue-500'}`}
                          style={{ width: `${(t.duration_ms / maxDuration) * 100}%` }}
                        />
                      </div>
                      <span className="font-mono text-[10px] text-amber-400 tabular-nums w-14 text-right">
                        {t.duration_ms.toFixed(1)}ms
                      </span>
                    </div>

                    {/* Timestamp */}
                    <span className="w-16 text-right text-[10px] text-gray-600 tabular-nums">
                      {timeAgo(t.timestamp)}
                    </span>
                  </button>

                  {/* Expanded span waterfall */}
                  {isExpanded && (
                    <div className="border-l-2 border-primary ml-0 bg-gray-950/50 rounded-b-lg overflow-hidden">
                      {loadingSpans ? (
                        <div className="flex items-center justify-center py-8">
                          <Loader2 className="w-4 h-4 animate-spin text-gray-500 mr-2" />
                          <span className="text-xs text-gray-500">Loading spans…</span>
                        </div>
                      ) : expandedSpans.length === 0 ? (
                        <p className="text-gray-500 text-center py-6 text-xs">No spans found for this trace.</p>
                      ) : (
                        <div className="max-h-[400px] overflow-auto">
                          <SpanWaterfall spans={expandedSpans} />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Load More */}
          {hasMore && (
            <div className="flex justify-center pt-4 mt-2 border-t border-white/5">
              <button
                onClick={loadMore}
                disabled={loadingMore}
                className="flex items-center gap-2 px-4 py-2 text-xs font-medium text-gray-400 hover:text-white bg-white/5 hover:bg-white/10 rounded-lg transition-all disabled:opacity-50"
              >
                {loadingMore ? (
                  <>
                    <Loader2 className="w-3 h-3 animate-spin" />
                    Loading…
                  </>
                ) : (
                  `Load More (${traces.length} of ${total})`
                )}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
