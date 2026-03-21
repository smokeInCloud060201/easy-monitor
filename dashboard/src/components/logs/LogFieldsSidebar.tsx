import { useState } from 'react';
import { Server, AlertCircle, Box, Layers, Globe, Search, ChevronDown, ChevronRight } from 'lucide-react';
import type { FieldStat } from '../../lib/api';

interface LogFieldsSidebarProps {
  fields: FieldStat[];
  totalLogs: number;
  activeFilters: Record<string, string>;
  onFilterChange: (field: string, value: string | null) => void;
}

const fieldIcons: Record<string, React.ReactNode> = {
  service: <Server size={14} />,
  level: <AlertCircle size={14} />,
  pod_id: <Box size={14} />,
  namespace: <Layers size={14} />,
  host: <Globe size={14} />,
};

export function LogFieldsSidebar({ fields, totalLogs, activeFilters, onFilterChange }: LogFieldsSidebarProps) {
  const [search, setSearch] = useState('');
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const filtered = fields.filter(f =>
    f.field.toLowerCase().includes(search.toLowerCase())
  );

  const toggleCollapse = (field: string) => {
    setCollapsed(prev => ({ ...prev, [field]: !prev[field] }));
  };

  return (
    <div className="w-60 flex-shrink-0 bg-gray-900/50 border-r border-gray-800 flex flex-col overflow-hidden">
      <div className="px-3 py-3 border-b border-gray-800">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-semibold text-gray-300">Fields</span>
          <span className="text-xs bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded-full">
            {totalLogs.toLocaleString()}
          </span>
        </div>
        <div className="relative">
          <Search size={14} className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Filter fields..."
            className="w-full bg-gray-800 border border-gray-700 rounded pl-7 pr-2 py-1 text-xs text-gray-300 focus:outline-none focus:border-blue-500"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {filtered.map(field => {
          const isCollapsed = collapsed[field.field];
          const icon = fieldIcons[field.field] || <Box size={14} />;
          const activeVal = activeFilters[field.field];

          return (
            <div key={field.field} className="border-b border-gray-800/50">
              <button
                onClick={() => toggleCollapse(field.field)}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-gray-400 hover:text-gray-200 hover:bg-gray-800/50 transition-colors"
              >
                <span className="text-gray-500">{icon}</span>
                {isCollapsed ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
                <span className="flex-1 text-left">{field.field}</span>
                <span className="text-gray-600">{field.top_values.length}</span>
              </button>

              {!isCollapsed && (
                <div className="px-3 pb-2 space-y-1">
                  {field.top_values.map(tv => {
                    const isActive = activeVal === tv.value;
                    return (
                      <button
                        key={tv.value}
                        onClick={() => onFilterChange(field.field, isActive ? null : tv.value)}
                        className={`w-full text-left rounded px-2 py-1 transition-colors group ${
                          isActive
                            ? 'bg-blue-500/20 border border-blue-500/40'
                            : 'hover:bg-gray-800/80 border border-transparent'
                        }`}
                      >
                        <div className="flex items-center justify-between text-xs">
                          <span className={`truncate ${isActive ? 'text-blue-400 font-medium' : 'text-gray-300'}`}>
                            {tv.value}
                          </span>
                          <span className="text-gray-500 ml-2 flex-shrink-0">{tv.count}</span>
                        </div>
                        <div className="mt-1 h-1 bg-gray-800 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${isActive ? 'bg-blue-500' : 'bg-gray-600 group-hover:bg-gray-500'}`}
                            style={{ width: `${Math.min(tv.percentage, 100)}%` }}
                          />
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
