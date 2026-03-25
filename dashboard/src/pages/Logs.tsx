import { useEffect, useState, useCallback } from 'react';
import { Search, RefreshCcw, Loader2 } from 'lucide-react';
import { fetchLogsEnhanced, fetchLogHistogram, fetchLogFields } from '../lib/api';
import { parseLogQuery } from '../lib/queryParser';
import type { LogLine, HistogramBucket, FieldStat } from '../lib/api';
import { LogViewer } from '../components/logs/LogViewer';
import { LogHistogram } from '../components/logs/LogHistogram';
import { LogFieldsSidebar } from '../components/logs/LogFieldsSidebar';

const LEVELS = ['All', 'INFO', 'WARN', 'ERROR', 'DEBUG'];
const PAGE_SIZE = 100;

interface Filters {
  keyword: string;
  service: string | null;
  level: string | null;
  pod_id: string | null;
  trace_id: string | null;
  host: string | null;
  source: string | null;
  namespace: string | null;
  node_name: string | null;
  from_ts: number | null;
  to_ts: number | null;
}

export function Logs() {
  const [logs, setLogs] = useState<LogLine[]>([]);
  const [total, setTotal] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [histogram, setHistogram] = useState<HistogramBucket[]>([]);
  const [fields, setFields] = useState<FieldStat[]>([]);
  const [totalLogs, setTotalLogs] = useState(0);
  const [loading, setLoading] = useState(false);
  const [selectedLogIndex, setSelectedLogIndex] = useState<number | null>(null);
  const [filters, setFilters] = useState<Filters>({
    keyword: '', service: null, level: null, pod_id: null, trace_id: null,
    host: null, source: null, namespace: null, node_name: null,
    from_ts: null, to_ts: null,
  });
  const [searchInput, setSearchInput] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    setSelectedLogIndex(null);

    const apiFilters = {
      keyword: filters.keyword || undefined,
      service: filters.service || undefined,
      level: filters.level || undefined,
      pod_id: filters.pod_id || undefined,
      trace_id: filters.trace_id || undefined,
      host: filters.host || undefined,
      source: filters.source || undefined,
      namespace: filters.namespace || undefined,
      node_name: filters.node_name || undefined,
      from_ts: filters.from_ts || undefined,
      to_ts: filters.to_ts || undefined,
      limit: PAGE_SIZE,
      offset: (currentPage - 1) * PAGE_SIZE,
    };

    try {
      const [logsData, histData, fieldsData] = await Promise.all([
        fetchLogsEnhanced(apiFilters),
        fetchLogHistogram({
          service: apiFilters.service,
          level: apiFilters.level,
          keyword: apiFilters.keyword,
          host: apiFilters.host,
          source: apiFilters.source,
          namespace: apiFilters.namespace,
          from_ts: apiFilters.from_ts,
          to_ts: apiFilters.to_ts,
        }),
        fetchLogFields({
          service: apiFilters.service,
          from_ts: apiFilters.from_ts,
          to_ts: apiFilters.to_ts,
        }),
      ]);

      setLogs(logsData.logs);
      setTotal(logsData.total);
      setHistogram(histData);
      setFields(fieldsData.fields);
      setTotalLogs(fieldsData.total_logs);
    } catch (err) {
      console.error('Failed to fetch log data:', err);
    } finally {
      setLoading(false);
    }
  }, [filters, currentPage]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = parseLogQuery(searchInput);
    setCurrentPage(1);
    setFilters(prev => ({
      ...prev,
      keyword: parsed.keyword || '',
      service: parsed.service || prev.service,
      level: parsed.level || prev.level,
      pod_id: parsed.pod_id || prev.pod_id,
      trace_id: parsed.trace_id || prev.trace_id,
      host: parsed.host || prev.host,
      source: parsed.source || prev.source,
      namespace: parsed.namespace || prev.namespace,
      node_name: parsed.node_name || prev.node_name,
    }));
  };

  const handleLevelChange = (level: string) => {
    setCurrentPage(1);
    setFilters(prev => ({ ...prev, level: level === 'All' ? null : level }));
  };

  const handleFieldFilter = (field: string, value: string | null) => {
    setCurrentPage(1);
    if (field === 'service') {
      setFilters(prev => ({ ...prev, service: value }));
    } else if (field === 'level') {
      setFilters(prev => ({ ...prev, level: value }));
    } else if (field === 'pod_id') {
      setFilters(prev => ({ ...prev, pod_id: value }));
    }
    // Other fields: add more as needed
  };

  const handleFilterByService = (service: string) => {
    setCurrentPage(1);
    setFilters(prev => ({ ...prev, service }));
  };

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const rangeStart = (currentPage - 1) * PAGE_SIZE + 1;
  const rangeEnd = Math.min(currentPage * PAGE_SIZE, total);

  const activeFilters: Record<string, string> = {};
  if (filters.service) activeFilters.service = filters.service;
  if (filters.level) activeFilters.level = filters.level;
  if (filters.pod_id) activeFilters.pod_id = filters.pod_id;
  if (filters.host) activeFilters.host = filters.host;
  if (filters.source) activeFilters.source = filters.source;
  if (filters.namespace) activeFilters.namespace = filters.namespace;
  if (filters.node_name) activeFilters.node_name = filters.node_name;

  const activeFilterCount = Object.keys(activeFilters).length + (filters.keyword ? 1 : 0);

  return (
    <div className="flex flex-col h-full bg-gray-950 overflow-hidden">
      {/* Top Bar */}
      <div className="px-4 py-3 flex items-center gap-3 border-b border-gray-800 bg-gray-950 z-10 flex-shrink-0">
        <h1 className="text-lg font-bold text-white tracking-tight flex-shrink-0">Log Explorer</h1>

        <form onSubmit={handleSearch} className="flex-1 max-w-xl relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
          <input
            type="text"
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            placeholder="Search logs... (field:value or keyword)"
            className="w-full bg-gray-900 border border-gray-800 rounded-lg pl-9 pr-4 py-2 text-sm text-gray-100 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all font-mono"
          />
        </form>

        {/* Level Filter */}
        <select
          value={filters.level || 'All'}
          onChange={e => handleLevelChange(e.target.value)}
          className="bg-gray-900 border border-gray-800 rounded-lg px-3 py-2 text-sm text-gray-300 focus:outline-none focus:border-blue-500 appearance-none cursor-pointer"
        >
          {LEVELS.map(l => (
            <option key={l} value={l}>{l}</option>
          ))}
        </select>

        {/* Results Badge */}
        <div className="flex items-center gap-2 text-sm text-gray-400 flex-shrink-0">
          <span className="bg-gray-800 rounded px-2 py-1 text-xs tabular-nums">
            {total.toLocaleString()} results
          </span>
          {activeFilterCount > 0 && (
            <button
              onClick={() => {
              setFilters({ keyword: '', service: null, level: null, pod_id: null, trace_id: null, host: null, source: null, namespace: null, node_name: null, from_ts: null, to_ts: null });
                setSearchInput('');
              }}
              className="text-xs text-blue-400 hover:text-blue-300"
            >
              Clear {activeFilterCount} filter{activeFilterCount > 1 ? 's' : ''}
            </button>
          )}
        </div>

        <button
          onClick={fetchData}
          className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
          title="Refresh"
        >
          {loading ? <Loader2 size={16} className="animate-spin" /> : <RefreshCcw size={16} />}
        </button>
      </div>

      {/* Histogram */}
      <div className="px-4 py-2 flex-shrink-0">
        <LogHistogram buckets={histogram} />
      </div>

      {/* Main Content: Sidebar + Log Table */}
      <div className="flex flex-1 overflow-hidden">
        <LogFieldsSidebar
          fields={fields}
          totalLogs={totalLogs}
          activeFilters={activeFilters}
          onFilterChange={handleFieldFilter}
        />

        <div className="flex-1 overflow-hidden bg-black/30">
          {/* Column Headers */}
          <div className="flex items-center gap-3 px-4 py-1.5 border-b border-gray-800 bg-gray-900/50 text-[10px] text-gray-500 font-semibold uppercase tracking-wider">
            <span className="w-[95px] flex-shrink-0">Time</span>
            <span className="w-[50px] flex-shrink-0 text-center">Level</span>
            <span className="w-[130px] flex-shrink-0">Service</span>
            <span className="flex-1">Message</span>
          </div>

          {/* Log Rows */}
          <div className="flex-1 h-[calc(100%-68px)]">
            <LogViewer
              logs={logs}
              selectedLogIndex={selectedLogIndex}
              onSelectLog={setSelectedLogIndex}
              onFilterByService={handleFilterByService}
            />
          </div>

          {/* Pagination Bar */}
          <div className="flex items-center justify-between px-4 py-2 border-t border-gray-800 bg-gray-900/70 flex-shrink-0">
            <span className="text-xs text-gray-500 tabular-nums">
              {total > 0 ? `${rangeStart.toLocaleString()}–${rangeEnd.toLocaleString()} of ${total.toLocaleString()}` : 'No results'}
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setCurrentPage(1)}
                disabled={currentPage <= 1}
                className="px-2 py-1 text-xs rounded font-medium transition-colors disabled:opacity-30 disabled:cursor-not-allowed text-gray-400 hover:text-white hover:bg-gray-800"
              >
                First
              </button>
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage <= 1}
                className="px-2.5 py-1 text-xs rounded font-medium transition-colors disabled:opacity-30 disabled:cursor-not-allowed text-gray-400 hover:text-white hover:bg-gray-800"
              >
                ← Prev
              </button>
              <span className="px-3 py-1 text-xs font-bold text-gray-200 bg-gray-800 rounded tabular-nums">
                {currentPage} / {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage >= totalPages}
                className="px-2.5 py-1 text-xs rounded font-medium transition-colors disabled:opacity-30 disabled:cursor-not-allowed text-gray-400 hover:text-white hover:bg-gray-800"
              >
                Next →
              </button>
              <button
                onClick={() => setCurrentPage(totalPages)}
                disabled={currentPage >= totalPages}
                className="px-2 py-1 text-xs rounded font-medium transition-colors disabled:opacity-30 disabled:cursor-not-allowed text-gray-400 hover:text-white hover:bg-gray-800"
              >
                Last
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
export default Logs;
