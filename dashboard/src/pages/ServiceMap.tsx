import { useEffect, useState, useCallback } from 'react';
import { RefreshCcw, Loader2, Network } from 'lucide-react';
import { fetchServiceMap } from '../lib/api';
import type { ServiceMapNode, ServiceMapEdge } from '../lib/api';
import { ServiceMapGraph } from '../components/service-map/ServiceMapGraph';
import { ServiceNodeTooltip } from '../components/service-map/ServiceNodeTooltip';

const TIME_RANGES = [
  { label: '15m', value: '15m' },
  { label: '1h', value: '1h' },
  { label: '6h', value: '6h' },
  { label: '24h', value: '24h' },
];

export function ServiceMap() {
  const [nodes, setNodes] = useState<ServiceMapNode[]>([]);
  const [edges, setEdges] = useState<ServiceMapEdge[]>([]);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState('1h');
  const [loading, setLoading] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchServiceMap(timeRange);
      setNodes(data.nodes);
      setEdges(data.edges);
    } catch (err) {
      console.error('Failed to fetch service map:', err);
    } finally {
      setLoading(false);
    }
  }, [timeRange]);

  useEffect(() => { loadData(); }, [loadData]);

  // Auto-refresh
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(loadData, 30000);
    return () => clearInterval(interval);
  }, [autoRefresh, loadData]);

  const handleNodeClick = useCallback((service: string) => {
    setSelectedNode(prev => prev === service ? null : service);
  }, []);

  const selectedNodeData = nodes.find(n => n.service === selectedNode) || null;

  return (
    <div className="flex flex-col h-full bg-background overflow-hidden">
      {/* Top Bar */}
      <div className="px-4 py-3 flex items-center gap-3 border-b border-border bg-background z-10 flex-shrink-0">
        <div className="flex items-center gap-2 flex-shrink-0">
          <Network size={20} className="text-blue-400" />
          <h1 className="text-lg font-bold text-text-primary tracking-tight">Service Map</h1>
        </div>

        <div className="flex-1" />

        {/* Time Range */}
        <div className="flex bg-surface rounded-lg border border-border overflow-hidden">
          {TIME_RANGES.map(tr => (
            <button
              key={tr.value}
              onClick={() => setTimeRange(tr.value)}
              className={`px-3 py-1.5 text-xs transition-colors ${
                timeRange === tr.value
                  ? 'bg-blue-500/20 text-blue-400 font-medium'
                  : 'text-text-secondary hover:text-text-primary hover:bg-surface-light'
              }`}
            >
              {tr.label}
            </button>
          ))}
        </div>

        {/* Auto-refresh toggle */}
        <button
          onClick={() => setAutoRefresh(!autoRefresh)}
          className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
            autoRefresh
              ? 'bg-green-500/10 border-green-500/30 text-green-400'
              : 'bg-surface border-border text-text-muted hover:text-text-primary'
          }`}
        >
          {autoRefresh ? '● Live' : '○ Live'}
        </button>

        <button
          onClick={loadData}
          className="p-2 text-text-secondary hover:text-text-primary hover:bg-surface-light rounded-lg transition-colors"
          title="Refresh"
        >
          {loading ? <Loader2 size={16} className="animate-spin" /> : <RefreshCcw size={16} />}
        </button>

        {/* Stats */}
        <div className="flex items-center gap-2 text-xs text-text-muted flex-shrink-0">
          <span className="bg-surface-light rounded px-2 py-1 tabular-nums">{nodes.length} nodes</span>
          <span className="bg-surface-light rounded px-2 py-1 tabular-nums">{edges.length} edges</span>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Graph */}
        <div className="flex-1">
          {nodes.length > 0 ? (
            <ServiceMapGraph
              nodes={nodes}
              edges={edges}
              onNodeClick={handleNodeClick}
              selectedNode={selectedNode}
            />
          ) : (
            <div className="h-full flex items-center justify-center text-text-muted flex-col gap-3">
              {loading ? (
                <Loader2 size={32} className="animate-spin text-blue-400" />
              ) : (
                <>
                  <Network size={48} className="text-text-secondary" />
                  <span className="text-sm">No service topology data available</span>
                  <span className="text-xs text-text-muted">Start your services and send some traffic</span>
                </>
              )}
            </div>
          )}
        </div>

        {/* Side Panel */}
        {selectedNodeData && (
          <ServiceNodeTooltip
            node={selectedNodeData}
            edges={edges}
            onClose={() => setSelectedNode(null)}
            onNavigateToService={() => {}}
          />
        )}
      </div>

      {/* Legend */}
      <div className="px-4 py-2 border-t border-border flex items-center gap-4 text-[10px] text-text-muted flex-shrink-0">
        <span className="font-semibold uppercase tracking-wider">Legend:</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500" /> Healthy</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500" /> Warning</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500" /> Error</span>
        <span className="mx-2 text-text-secondary">|</span>
        <span>→ Request flow</span>
        <span className="text-red-400">→ High error rate</span>
      </div>
    </div>
  );
}
export default ServiceMap;
