import { useMemo } from 'react';
import ReactFlow, {
  Controls,
  Background,
  MarkerType,
  Handle,
  Position,
  type Node,
  type Edge,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { Server, Database, Globe, Zap } from 'lucide-react';
import type { ServiceMapNode as APINode, ServiceMapEdge as APIEdge } from '../../lib/api';

interface ServiceMapGraphProps {
  nodes: APINode[];
  edges: APIEdge[];
  onNodeClick: (service: string) => void;
  selectedNode: string | null;
}

const statusColors: Record<string, string> = {
  healthy: '#22c55e',
  warning: '#f59e0b',
  error: '#ef4444',
};

const typeIcons: Record<string, React.ReactNode> = {
  service: <Server size={20} />,
  database: <Database size={20} />,
  external: <Globe size={20} />,
  cache: <Zap size={20} />,
};

function formatRequests(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return Math.round(n).toString();
}

function ServiceNode({ data }: { data: { node: APINode; isSelected: boolean; onClick: () => void } }) {
  const { node, isSelected, onClick } = data;
  const ringColor = statusColors[node.status] || statusColors.healthy;
  const icon = typeIcons[node.node_type] || typeIcons.service;

  return (
    <div onClick={onClick} className="cursor-pointer group">
      <Handle type="target" position={Position.Top} className="!bg-surface-light !border-border !w-2 !h-2" />

      <div
        className="flex flex-col items-center gap-1 transition-transform"
        style={{ transform: isSelected ? 'scale(1.1)' : 'scale(1)' }}
      >
        {/* Node circle with health ring */}
        <div
          className="w-16 h-16 rounded-full flex items-center justify-center transition-shadow"
          style={{
            border: `3px solid ${isSelected ? '#3b82f6' : ringColor}`,
            backgroundColor: 'var(--color-bg-surface-light)',
            boxShadow: isSelected
              ? '0 0 20px rgba(59,130,246,0.4)'
              : `0 0 12px ${ringColor}33`,
          }}
        >
          <span className="text-text-primary group-hover:text-text-primary transition-colors">{icon}</span>
        </div>

        {/* Service name */}
        <span className="text-[11px] text-text-primary font-medium text-center max-w-[100px] truncate leading-tight">
          {node.service}
        </span>

        {/* Request badge */}
        <span className="text-[9px] bg-surface-light text-text-secondary rounded-full px-2 py-0.5">
          {formatRequests(node.total_requests)} req
        </span>
      </div>

      <Handle type="source" position={Position.Bottom} className="!bg-surface-light !border-border !w-2 !h-2" />
    </div>
  );
}

const nodeTypes = { serviceNode: ServiceNode };

function layoutNodes(apiNodes: APINode[]): Node[] {
  // Simple layered layout: group by connection depth approximation
  // Arrange in a grid with some spacing
  const cols = Math.ceil(Math.sqrt(apiNodes.length));
  const spacingX = 200;
  const spacingY = 160;

  return apiNodes.map((node, i) => ({
    id: node.service,
    type: 'serviceNode',
    position: {
      x: (i % cols) * spacingX + 50,
      y: Math.floor(i / cols) * spacingY + 50,
    },
    data: { node, isSelected: false, onClick: () => {} },
  }));
}

export function ServiceMapGraph({ nodes: apiNodes, edges: apiEdges, onNodeClick, selectedNode }: ServiceMapGraphProps) {
  const flowNodes = useMemo<Node[]>(() => {
    const laid = layoutNodes(apiNodes);
    return laid.map(n => ({
      ...n,
      data: {
        ...n.data,
        isSelected: n.id === selectedNode,
        onClick: () => onNodeClick(n.id),
      },
    }));
  }, [apiNodes, selectedNode, onNodeClick]);

  const flowEdges = useMemo<Edge[]>(() =>
    apiEdges.map((e, i) => {
      const thickness = Math.max(1, Math.min(5, Math.log2(e.requests + 1)));
      const isError = e.error_rate > 10;
      return {
        id: `edge-${i}`,
        source: e.source,
        target: e.target,
        animated: e.requests > 100,
        style: {
          stroke: isError ? '#ef4444' : 'var(--color-text-muted)',
          strokeWidth: thickness,
        },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: isError ? '#ef4444' : 'var(--color-text-muted)',
          width: 16,
          height: 16,
        },
        label: `${formatRequests(e.requests)}`,
        labelStyle: { fill: 'var(--color-text-primary)', fontSize: 10, fontWeight: 500 },
        labelBgStyle: { fill: 'var(--color-bg-surface-light)', fillOpacity: 0.9 },
        labelBgPadding: [6, 4] as [number, number],
        labelBgBorderRadius: 12,
      };
    }), [apiEdges]);



  return (
    <div className="h-full w-full bg-background rounded-tl-xl overflow-hidden shadow-card">
      <ReactFlow
        nodes={flowNodes}
        edges={flowEdges}
        nodeTypes={nodeTypes}
        fitView
        attributionPosition="bottom-left"
        proOptions={{ hideAttribution: true }}
        minZoom={0.3}
        maxZoom={2}
      >
        <Controls
          className="!bg-surface-light !border-border !shadow-lg [&>button]:!bg-surface-light [&>button]:!border-border [&>button]:!text-text-secondary [&>button:hover]:!bg-surface"
        />
        <Background gap={20} size={1} color="var(--color-border)" />
      </ReactFlow>
    </div>
  );
}
