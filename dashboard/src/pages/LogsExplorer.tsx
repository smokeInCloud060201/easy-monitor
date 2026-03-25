import { useState, useEffect } from 'react';
import { Search, Terminal, RefreshCcw, Loader2 } from 'lucide-react';
import { fetchLogsEnhanced } from '../lib/api';

interface LogLine {
  trace_id: string;
  service: string;
  message: string;
}

export default function LogsExplorer() {
  const [logs, setLogs] = useState<LogLine[]>([]);
  const [keyword, setKeyword] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchLogsData();
  }, []);

  const fetchLogsData = () => {
    setLoading(true);
    fetchLogsEnhanced({
      keyword: keyword || undefined,
      limit: 200
    })
    .then(res => {
      setLogs(res.logs || []);
    })
    .catch(console.error)
    .finally(() => setLoading(false));
  };

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 h-[calc(100vh-8rem)] flex flex-col">
      <div className="flex justify-between items-end mb-6">
        <div>
          <h1 className="text-4xl font-extrabold tracking-tight mb-2">Logs Explorer</h1>
          <p className="text-gray-400">Real-time full-text search directly over massive ClickHouse clusters natively.</p>
        </div>
        <div className="flex gap-4 items-center">
          <div className="relative w-[400px]">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
            <input 
              type="text" 
              placeholder="Search Graylog syntax (e.g. level:ERROR AND message:&quot;failed&quot;)..." 
              value={keyword}
              onChange={e => setKeyword(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && fetchLogsData()}
              className="glass-panel pl-9 pr-4 py-2 w-full text-sm bg-black/40 border-primary/20 focus:outline-none focus:border-primary placeholder:text-gray-600"
            />
          </div>
          
          <button 
            onClick={fetchLogsData}
            className="btn btn-primary p-2 h-[38px] w-[38px] flex justify-center items-center"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCcw className="w-4 h-4" />}
          </button>
        </div>
      </div>

      <div className="flex-1 glass-panel overflow-hidden flex flex-col relative border-white/10 shadow-lg">
        <div className="bg-black/80 text-gray-400 text-xs px-4 py-2 flex items-center gap-2 border-b border-white/5 font-mono shadow-md">
          <Terminal className="w-4 h-4 text-primary" />
          <span>master-service / tantivy / tailer</span>
          <span className="ml-auto text-primary/70">{logs.length} indexed lines found</span>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4 font-mono text-sm leading-relaxed bg-[#0a0a0c]">
          {loading && logs.length === 0 ? (
            <div className="h-full flex items-center justify-center">
               <Loader2 className="w-8 h-8 animate-spin text-primary opacity-50" />
            </div>
          ) : logs.length === 0 ? (
            <div className="text-gray-600 h-full flex items-center justify-center flex-col italic">
               <span className="mb-2 text-3xl">📭</span>
               No matching tail logs indexed
            </div>
          ) : (
            logs.map((log, i) => (
              <div key={i} className="hover:bg-white/5 px-2 py-1 -mx-2 rounded transition-colors break-words flex flex-wrap lg:flex-nowrap gap-x-3 mb-1">
                <span className="text-gray-500 shrink-0">[{log.trace_id.substring(0, 8)}]</span>
                <span className="text-emerald-400 shrink-0 font-bold w-32 truncate" title={log.service}>{log.service}</span>
                <span className="text-gray-300 ml-2 whitespace-pre-wrap text-xs">{log.message}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
