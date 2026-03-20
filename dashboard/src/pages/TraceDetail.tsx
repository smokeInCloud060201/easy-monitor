import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { fetchTrace, type SpanResponse, fetchLogs, type LogLineResponse } from '../lib/api';
import { SpanWaterfall } from '../components/traces/SpanWaterfall';
import { LogViewer } from '../components/logs/LogViewer';
import { ArrowLeft } from 'lucide-react';

export function TraceDetail() {
  const { traceId } = useParams<{ traceId: string }>();
  const [spans, setSpans] = useState<SpanResponse[]>([]);
  const [logs, setLogs] = useState<LogLineResponse[]>([]);
  const [loading, setLoading] = useState(true);
  
  // TRAC-02 log correlation 
  // Selecting a span doesn't alter the trace ID query for now (we exact match the trace), 
  // but we could filter logs by span.service if we wanted.
  const [activeSpan, setActiveSpan] = useState<SpanResponse | null>(null);

  useEffect(() => {
    if (!traceId) return;

    let active = true;
    setLoading(true);
    
    // Fetch both traces and correlated logs concurrently
    Promise.all([
      fetchTrace(traceId),
      // MOCK BEHAVIOR: We pass traceId as 'query' to fetchLogs to fulfill TRAC-02.
      // Master-service will return our 100 mock logs, but in a real system this hits the TermQuery.
      fetchLogs('now-1h', 'now', traceId)
    ]).then(([fetchedSpans, fetchedLogs]) => {
      if (active) {
        setSpans(fetchedSpans);
        setLogs(fetchedLogs);
        setLoading(false);
      }
    });

    return () => { active = false; };
  }, [traceId]);

  if (loading) {
    return <div className="flex-1 flex items-center justify-center text-gray-500 bg-gray-950">Loading trace data...</div>;
  }

  const filteredLogs = activeSpan 
    ? logs.filter(log => log.service === activeSpan.service || log.trace_id === activeSpan.trace_id) // mock behavior smoothing
    : logs;

  return (
    <div className="flex-1 flex flex-col h-full bg-gray-950 text-gray-200 overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-800 bg-gray-900 flex items-center gap-4 flex-shrink-0 z-20 shadow-sm">
        <Link to="/logs" className="p-2 hover:bg-gray-800 rounded-lg text-gray-400 hover:text-white transition-colors">
          <ArrowLeft size={20} />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-3">
            Trace View
            <span className="text-sm font-normal text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/20">{traceId}</span>
          </h1>
          <p className="text-xs text-gray-500 mt-1">{spans.length} spans • {spans[0]?.timestamp}</p>
        </div>
      </div>

      {/* Waterfall Pane (Top 60%) */}
      <div className="h-[60%] border-b border-gray-800 bg-gray-950 relative">
        <SpanWaterfall 
          spans={spans} 
          onSpanClick={(span) => setActiveSpan(span)} 
          activeSpanId={activeSpan?.span_id} 
        />
      </div>

      {/* Logs Pane (Bottom 40%) */}
      <div className="h-[40%] flex flex-col bg-black relative shadow-[inset_0_10px_20px_rgba(0,0,0,0.5)]">
        <div className="px-4 py-2 border-b border-gray-800 bg-gray-900 flex items-center justify-between text-xs font-semibold text-gray-400 tracking-wider">
          <span>Correlated Logs {activeSpan ? `for ${activeSpan.service}` : `for entire trace`} ({filteredLogs.length})</span>
          {activeSpan && (
            <button 
              onClick={() => setActiveSpan(null)}
              className="px-2 py-1 hover:bg-gray-800 rounded text-gray-300 uppercase tracking-widest text-[10px]"
            >
              Clear Filter
            </button>
          )}
        </div>
        <div className="flex-1 overflow-hidden">
          <LogViewer logs={filteredLogs} />
        </div>
      </div>
    </div>
  );
}
