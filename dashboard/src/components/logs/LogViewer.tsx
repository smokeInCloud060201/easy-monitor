import { useCallback } from 'react';
import { Virtuoso } from 'react-virtuoso';
import { LogDetailPanel } from './LogDetailPanel';

interface LogViewerProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  logs: any[];
  onLoadMore?: () => void;
  selectedLogIndex: number | null;
  onSelectLog: (index: number | null) => void;
  onFilterByService?: (service: string) => void;
}

const levelColors: Record<string, { badge: string; border: string }> = {
  ERROR: { badge: 'bg-red-500/20 text-red-400', border: 'border-l-red-500' },
  WARN: { badge: 'bg-amber-500/20 text-amber-400', border: 'border-l-amber-500' },
  INFO: { badge: 'bg-blue-500/20 text-blue-400', border: 'border-l-blue-500' },
  DEBUG: { badge: 'bg-gray-600/30 text-gray-500', border: 'border-l-gray-600' },
};

const getLevelName = (level: string) => {
  const map: Record<string, string> = {
    '0': 'EMERG', '1': 'ALERT', '2': 'CRITICAL', '3': 'ERROR',
    '4': 'WARN', '5': 'NOTICE', '6': 'INFO', '7': 'DEBUG'
  };
  return map[level] || level;
};

export function LogViewer({ logs, onLoadMore, selectedLogIndex, onSelectLog, onFilterByService }: LogViewerProps) {
  const formatTime = (ts: string) => {
    try {
      const d = new Date(ts);
      return d.toLocaleTimeString('en-US', { hour12: false }) + '.' + String(d.getMilliseconds()).padStart(3, '0');
    } catch {
      return ts;
    }
  };

  const handleEndReached = useCallback(() => {
    onLoadMore?.();
  }, [onLoadMore]);

  if (!logs || logs.length === 0) {
    return (
      <div className="h-full flex items-center justify-center text-gray-500 flex-col gap-2">
        <span className="text-3xl">📭</span>
        <span className="text-sm">No logs found</span>
      </div>
    );
  }

  return (
    <Virtuoso
      style={{ height: '100%', width: '100%' }}
      data={logs}
      endReached={handleEndReached}
      overscan={200}
      itemContent={(index, log) => {
        const levelName = getLevelName(log.level);
        const colors = levelColors[levelName] || levelColors.INFO;
        const isSelected = selectedLogIndex === index;

        return (
          <div>
            <div
              onClick={() => onSelectLog(isSelected ? null : index)}
              className={`flex items-center gap-3 px-4 py-1.5 cursor-pointer border-l-2 transition-all font-mono text-sm ${colors.border} ${
                isSelected
                  ? 'bg-blue-500/10 border-b-0'
                  : 'hover:bg-white/5 border-b border-b-gray-800/40'
              }`}
            >
              {/* Timestamp */}
              <span className="text-gray-500 text-xs w-[95px] flex-shrink-0 tabular-nums">
                {formatTime(log.timestamp)}
              </span>

              {/* Level Badge */}
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${colors.badge} w-[50px] text-center flex-shrink-0`}>
                {levelName}
              </span>

              {/* Service */}
              <span className="text-emerald-400/80 w-[130px] flex-shrink-0 truncate text-xs" title={log.service}>
                {log.service}
              </span>

              {/* Message */}
              <span className="text-gray-300 flex-1 truncate text-xs">
                {log.message}
              </span>
            </div>

            {/* Expandable Detail */}
            {isSelected && (
              <LogDetailPanel
                log={log}
                onClose={() => onSelectLog(null)}
                onFilterByService={onFilterByService}
              />
            )}
          </div>
        );
      }}
    />
  );
}
