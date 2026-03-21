import { Link } from 'react-router-dom';
import { X, ExternalLink, Copy, Filter } from 'lucide-react';
import type { LogLine } from '../../lib/api';

interface LogDetailPanelProps {
  log: LogLine;
  onClose: () => void;
  onFilterByService?: (service: string) => void;
}

const levelColors: Record<string, string> = {
  ERROR: 'bg-red-500/20 text-red-400 border-red-500/40',
  WARN: 'bg-amber-500/20 text-amber-400 border-amber-500/40',
  INFO: 'bg-blue-500/20 text-blue-400 border-blue-500/40',
  DEBUG: 'bg-gray-500/20 text-gray-400 border-gray-500/40',
};

export function LogDetailPanel({ log, onClose, onFilterByService }: LogDetailPanelProps) {
  const copyLog = () => {
    navigator.clipboard.writeText(JSON.stringify(log, null, 2));
  };

  const fields = [
    { label: 'Timestamp', value: log.timestamp },
    { label: 'Service', value: log.service, badge: true },
    { label: 'Level', value: log.level, levelBadge: true },
    { label: 'Trace ID', value: log.trace_id, isTraceLink: true },
    { label: 'Span ID', value: log.span_id },
    { label: 'Pod ID', value: log.pod_id },
    { label: 'Namespace', value: log.namespace },
    { label: 'Node', value: log.node_name },
    { label: 'Host', value: log.host },
    { label: 'Source', value: log.source },
  ].filter(f => f.value);

  const attrs = Object.entries(log.attributes || {});

  return (
    <div className="bg-gray-900 border border-gray-700 rounded-lg mx-2 mb-1 animate-in slide-in-from-top-2 duration-200 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-gray-800/50 border-b border-gray-700">
        <span className="text-xs font-semibold text-gray-300 tracking-wide uppercase">Log Detail</span>
        <div className="flex items-center gap-2">
          {log.trace_id && (
            <Link
              to={`/traces/${log.trace_id}`}
              className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 transition-colors"
            >
              <ExternalLink size={12} />
              View Trace
            </Link>
          )}
          <button
            onClick={copyLog}
            className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-200 transition-colors"
          >
            <Copy size={12} />
            Copy
          </button>
          {onFilterByService && log.service && (
            <button
              onClick={() => onFilterByService(log.service)}
              className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-200 transition-colors"
            >
              <Filter size={12} />
              Filter
            </button>
          )}
          <button onClick={onClose} className="text-gray-500 hover:text-gray-300 transition-colors">
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Message */}
      <div className="px-4 py-3 border-b border-gray-800">
        <div className="text-xs text-gray-500 mb-1">Message</div>
        <pre className="text-sm text-gray-200 font-mono whitespace-pre-wrap break-all leading-relaxed">
          {log.message}
        </pre>
      </div>

      {/* Fields Grid */}
      <div className="grid grid-cols-2 gap-x-6 gap-y-0 px-4 py-3">
        {fields.map(f => (
          <div key={f.label} className="flex items-center py-1.5 border-b border-gray-800/50">
            <span className="text-xs text-gray-500 font-mono w-24 flex-shrink-0">{f.label}</span>
            <span className="text-xs text-gray-200 truncate flex-1">
              {f.isTraceLink ? (
                <Link to={`/traces/${f.value}`} className="text-blue-400 hover:text-blue-300 underline underline-offset-2">
                  {f.value}
                </Link>
              ) : f.levelBadge ? (
                <span className={`px-2 py-0.5 rounded border text-xs font-bold ${levelColors[f.value || ''] || levelColors.INFO}`}>
                  {f.value}
                </span>
              ) : f.badge ? (
                <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 text-xs font-medium">
                  {f.value}
                </span>
              ) : (
                <span className="font-mono">{f.value}</span>
              )}
            </span>
          </div>
        ))}
      </div>

      {/* Attributes */}
      {attrs.length > 0 && (
        <div className="px-4 py-3 border-t border-gray-800">
          <div className="text-xs text-gray-500 mb-2 font-semibold">Attributes</div>
          <div className="grid grid-cols-2 gap-x-6 gap-y-0">
            {attrs.map(([key, val]) => (
              <div key={key} className="flex items-center py-1 border-b border-gray-800/30">
                <span className="text-xs text-gray-500 font-mono w-24 flex-shrink-0">{key}</span>
                <span className="text-xs text-gray-300 font-mono truncate">{String(val)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
