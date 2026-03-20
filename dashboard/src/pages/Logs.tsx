import { useEffect, useState } from 'react';
import { useTimeRange } from '../hooks/useTimeRange';
import { fetchLogs, type LogLineResponse } from '../lib/api';
import { LogViewer } from '../components/logs/LogViewer';
import { Search } from 'lucide-react';

export function Logs() {
  const { from, to } = useTimeRange();
  const [logs, setLogs] = useState<LogLineResponse[]>([]);
  const [query, setQuery] = useState('');
  const [activeQuery, setActiveQuery] = useState('');

  useEffect(() => {
    let active = true;
    fetchLogs(from, to, activeQuery).then(result => {
      if (active) {
        setLogs(result);
      }
    });

    // In a real live-tail system, we'd hook up an EventSource/WebSocket here
    return () => { active = false; };
  }, [from, to, activeQuery]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setActiveQuery(query);
  };

  return (
    <div className="flex flex-col h-full bg-gray-950">
      <div className="px-6 py-4 flex items-center justify-between border-b border-gray-800 bg-gray-950 z-10">
        <h1 className="text-xl font-bold text-white tracking-tight">Log Explorer</h1>
        
        <form onSubmit={handleSearch} className="flex-1 max-w-xl mx-8 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search logs by keyword..."
            className="w-full bg-gray-900 border border-gray-800 rounded-lg pl-10 pr-4 py-2 text-sm text-gray-100 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all font-sans"
          />
        </form>

        <div className="flex items-center gap-2 bg-gray-900 border border-gray-800 rounded-lg px-4 py-2 text-sm text-gray-400 focus-within:border-blue-500 transition-colors">
          <span>{from}</span>
          <span className="text-gray-600 px-1">→</span>
          <span>{to}</span>
        </div>
      </div>
      
      <div className="flex-1 overflow-hidden relative bg-black">
        <LogViewer logs={logs} />
      </div>
    </div>
  );
}
