import { useMemo } from 'react';
import type { SpanResponse } from '../../lib/api';

interface SpanNode extends SpanResponse {
  children: SpanNode[];
  depth: number;
}

interface Props {
  spans: SpanResponse[];
  onSpanClick?: (span: SpanResponse) => void;
  activeSpanId?: string;
}

function buildSpanTree(spans: SpanResponse[]): SpanNode[] {
  const spanMap = new Map<string, SpanNode>();
  const roots: SpanNode[] = [];

  // Initialize map
  for (const span of spans) {
    spanMap.set(span.span_id, { ...span, children: [], depth: 0 });
  }

  // Build tree
  for (const span of spans) {
    const node = spanMap.get(span.span_id)!;
    if (span.parent_id && spanMap.has(span.parent_id)) {
      spanMap.get(span.parent_id)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  // Calculate depths recursively
  function setDepth(node: SpanNode, depth: number) {
    node.depth = depth;
    for (const child of node.children) {
      setDepth(child, depth + 1);
    }
  }
  roots.forEach(r => setDepth(r, 0));

  return roots;
}

// Flatten tree for rendering in order
function flattenTree(nodes: SpanNode[]): SpanNode[] {
  let result: SpanNode[] = [];
  for (const node of nodes) {
    result.push(node);
    result = result.concat(flattenTree(node.children));
  }
  return result;
}

export function SpanWaterfall({ spans, onSpanClick, activeSpanId }: Props) {
  const { rootSpan, flatNodes } = useMemo(() => {
    if (!spans || spans.length === 0) return { rootSpan: null, flatNodes: [] };
    const tree = buildSpanTree(spans);
    // Find the actual trace root (earliest timestamp or unparented fallback)
    const root = tree[0]; 
    return { rootSpan: spans.find(s => s.span_id === root?.span_id) || spans[0], flatNodes: flattenTree(tree) };
  }, [spans]);

  if (!rootSpan) return <div className="p-4 text-text-muted">No spans found for trace.</div>;

  const rootStart = new Date(rootSpan.timestamp).getTime();
  const rootDuration = rootSpan.duration_ms;

  return (
    <div className="flex flex-col w-full h-full overflow-y-auto font-sans bg-background">
      <div className="flex bg-surface border-b border-border text-xs text-text-secondary p-2 sticky top-0 z-10 font-semibold tracking-wide">
        <div className="w-1/3 min-w-[300px] pl-4">Service & Operation</div>
        <div className="w-2/3 flex relative border-l border-border pl-4 items-center">
          <span className="absolute -top-1 left-4">0ms</span>
          <span className="absolute -top-1 right-4">{rootDuration.toFixed(2)}ms</span>
        </div>
      </div>

      <div className="flex-1 w-full pb-8">
        {flatNodes.map((node) => {
          const spanStart = new Date(node.timestamp).getTime();
          const offsetMs = Math.max(0, spanStart - rootStart);
          const leftPercent = rootDuration > 0 ? (offsetMs / rootDuration) * 100 : 0;
          const widthPercent = rootDuration > 0 ? (node.duration_ms / rootDuration) * 100 : 100;
          
          const isActive = activeSpanId === node.span_id;

          return (
            <div 
              key={node.span_id} 
              className={`flex border-b border-border hover:bg-surface-light transition-colors cursor-pointer group ${isActive ? 'bg-blue-900/20' : ''}`}
              onClick={() => onSpanClick?.(node)}
            >
              <div 
                className="w-1/3 min-w-[300px] py-2 pr-4 flex items-center gap-2 border-r border-border"
                style={{ paddingLeft: `${1 + node.depth * 1.5}rem` }}
              >
                <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: getServiceColor(node.service) }}></div>
                <div className="flex flex-col min-w-0">
                  <span className="text-sm font-medium text-text-primary truncate">{node.name}</span>
                  <span className="text-xs text-text-muted truncate">{node.service} • {node.duration_ms.toFixed(2)}ms</span>
                </div>
              </div>

              <div className="w-2/3 py-3 px-4 relative flex items-center">
                <div 
                  className={`absolute h-4 rounded-sm transition-all duration-300 ${isActive ? 'ring-1 ring-white shadow-[0_0_8px_rgba(255,255,255,0.2)]' : 'ring-1 ring-black/20'} overflow-hidden relative group-hover:brightness-110`}
                  style={{ 
                    left: `calc(1rem + ${Math.min(98, leftPercent)}% * 0.95)`, 
                    width: `calc(max(0.2%, ${Math.min(100 - leftPercent, widthPercent)}%) * 0.95)`,
                    backgroundColor: getServiceColor(node.service)
                  }}
                >
                  <div className="absolute inset-0 bg-gradient-to-b from-white/10 to-transparent"></div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Helper for consistent service colors
function getServiceColor(service: string) {
  const colors = [
    '#3b82f6', // blue
    '#10b981', // emerald
    '#f59e0b', // amber
    '#8b5cf6', // violet
    '#ef4444', // red
    '#06b6d4', // cyan
  ];
  let hash = 0;
  for (let i = 0; i < service.length; i++) hash = service.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}
