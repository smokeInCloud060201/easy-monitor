import { Virtuoso } from 'react-virtuoso';
import { Link } from 'react-router-dom';
import type { LogLineResponse } from '../../lib/api';

interface Props {
  logs: LogLineResponse[];
}

export function LogViewer({ logs }: Props) {
  if (!logs || logs.length === 0) {
    return <div className="h-full flex items-center justify-center text-gray-500">No logs found</div>;
  }

  return (
    <Virtuoso
      style={{ height: '100%', width: '100%' }}
      data={logs}
      followOutput="smooth"
      itemContent={(_index, log) => {
        // extract level from mock message format "[INFO] User login successful"
        const match = log.message.match(/^\[(INFO|WARN|ERROR|DEBUG)\]\s*(.*)$/);
        const level = match ? match[1] : 'INFO';
        const text = match ? match[2] : log.message;

        let levelColor = 'text-blue-400';
        if (level === 'ERROR') levelColor = 'text-red-500';
        if (level === 'WARN') levelColor = 'text-yellow-500';
        if (level === 'DEBUG') levelColor = 'text-gray-500';

        return (
          <div className="flex gap-4 py-1.5 border-b border-gray-800/60 font-mono text-sm hover:bg-white/5 transition-colors px-4">
            <Link 
              to={`/traces/${log.trace_id}`}
              className="w-32 flex-shrink-0 text-blue-400/80 hover:text-blue-400 font-medium truncate underline underline-offset-2 decoration-blue-500/30 hover:decoration-blue-500" 
              title={log.trace_id}
            >
              {log.trace_id.split('-').slice(0, 2).join('-')}
            </Link>
            <div className="w-36 flex-shrink-0 text-gray-400 truncate" title={log.service}>
              {log.service}
            </div>
            <div className={`w-14 flex-shrink-0 font-bold ${levelColor}`}>
              {level}
            </div>
            <div className="flex-1 text-gray-300 break-all">
              {text}
            </div>
          </div>
        );
      }}
    />
  );
}
