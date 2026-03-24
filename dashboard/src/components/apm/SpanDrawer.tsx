import { useState, useEffect, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { X, Clock, Layers, AlertTriangle, Loader2, ChevronDown, Globe, Hash, Info } from 'lucide-react';
import { fetchTrace, type TraceSummary, type SpanResponse } from '../../lib/api';

// ─── Props ───
interface SpanDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  serviceName: string;
  resource: string;
  traces: TraceSummary[];
  loadingTraces: boolean;
  zIndex?: number;         // for nested drawer stacking (default 40)
  singleTraceMode?: boolean; // hide trace list sidebar, auto-select first trace
}

// ─── Tree Types ───
interface SpanNode extends SpanResponse {
  children: SpanNode[];
  depth: number;
  execTime: number;
  execPercent: number;
}

// ─── Tree Builder ───
function buildSpanTree(spans: SpanResponse[]): SpanNode[] {
  const map = new Map<string, SpanNode>();
  const roots: SpanNode[] = [];

  for (const s of spans) {
    map.set(s.span_id, { ...s, children: [], depth: 0, execTime: 0, execPercent: 0 });
  }

  for (const s of spans) {
    const node = map.get(s.span_id)!;
    if (s.parent_id && map.has(s.parent_id)) {
      map.get(s.parent_id)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  function setDepth(node: SpanNode, depth: number) {
    node.depth = depth;
    node.children.forEach(c => setDepth(c, depth + 1));
  }
  roots.forEach(r => setDepth(r, 0));

  return roots;
}

function flattenTree(nodes: SpanNode[]): SpanNode[] {
  const result: SpanNode[] = [];
  for (const n of nodes) {
    result.push(n);
    result.push(...flattenTree(n.children));
  }
  return result;
}

function computeSelfTimes(nodes: SpanNode[], rootDuration: number) {
  for (const n of nodes) {
    const childrenDuration = n.children.reduce((sum, c) => sum + c.duration_ms, 0);
    n.execTime = Math.max(0, n.duration_ms - childrenDuration);
    n.execPercent = rootDuration > 0 ? (n.execTime / rootDuration) * 100 : 0;
    computeSelfTimes(n.children, rootDuration);
  }
}

// ─── Helpers ───
const SERVICE_COLORS = [
  '#6366f1', '#8b5cf6', '#a855f7', '#ec4899', '#f43f5e',
  '#f97316', '#eab308', '#22c55e', '#14b8a6', '#06b6d4',
  '#3b82f6', '#6d28d9',
];

function getServiceColor(service: string): string {
  let hash = 0;
  for (let i = 0; i < service.length; i++) hash = service.charCodeAt(i) + ((hash << 5) - hash);
  return SERVICE_COLORS[Math.abs(hash) % SERVICE_COLORS.length];
}

function formatDuration(ms: number): string {
  if (ms < 1) return `${(ms * 1000).toFixed(0)}µs`;
  if (ms < 1000) return `${ms.toFixed(1)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

function formatPercent(pct: number): string {
  if (pct < 0.1) return '<0.1%';
  return `${pct.toFixed(2)}%`;
}

function formatTimestamp(ts: string): string {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

const methodColors: Record<string, string> = {
  GET: 'bg-blue-500/20 text-blue-400',
  POST: 'bg-green-500/20 text-green-400',
  PUT: 'bg-amber-500/20 text-amber-400',
  DELETE: 'bg-red-500/20 text-red-400',
  PATCH: 'bg-purple-500/20 text-purple-400',
};

function extractMethod(resource: string): { method: string | null; path: string } {
  const match = resource.match(/(?:^|\s)(GET|POST|PUT|DELETE|PATCH|HEAD|OPTIONS)(?:\s|$)/);
  if (match) {
    const method = match[1];
    const path = resource.slice(resource.indexOf(method) + method.length).trim() || '/';
    return { method, path };
  }
  return { method: null, path: resource };
}

// ─── HTTP Attribute Keys ───
const HTTP_ATTR_KEYS = [
  { key: 'http.method',      label: 'HTTP Method',  icon: '🔵' },
  { key: 'http.status_code', label: 'Status Code',  icon: '📊' },
  { key: 'http.url',         label: 'Full URL',     icon: '🔗' },
  { key: 'http.target',      label: 'HTTP Target',  icon: '🎯' },
  { key: 'http.route',       label: 'HTTP Route',   icon: '🛤️' },
  { key: 'http.host',        label: 'HTTP Host',    icon: '🏠' },
  { key: 'http.scheme',      label: 'HTTP Scheme',  icon: '🔒' },
  { key: 'http.user_agent',  label: 'User Agent',   icon: '🖥️' },
  { key: 'http.flavor',      label: 'HTTP Version',  icon: '📋' },
  { key: 'net.peer.name',    label: 'Peer Name',    icon: '🌐' },
  { key: 'net.peer.port',    label: 'Peer Port',    icon: '🔌' },
  { key: 'http.request_content_length', label: 'Request Size', icon: '📦' },
  { key: 'http.response_content_length', label: 'Response Size', icon: '📦' },
];

function isHttpSpan(attrs: Record<string, string>): boolean {
  return Object.keys(attrs).some(k => k.startsWith('http.') || k.startsWith('net.'));
}

function getStatusCodeColor(code: string): string {
  const n = parseInt(code);
  if (n >= 200 && n < 300) return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30';
  if (n >= 300 && n < 400) return 'text-blue-400 bg-blue-500/10 border-blue-500/30';
  if (n >= 400 && n < 500) return 'text-amber-400 bg-amber-500/10 border-amber-500/30';
  if (n >= 500) return 'text-red-400 bg-red-500/10 border-red-500/30';
  return 'text-gray-400 bg-gray-500/10 border-gray-500/30';
}

// ─── Main Component ───
export function SpanDrawer({ isOpen, onClose, serviceName, resource, traces, loadingTraces, zIndex = 40, singleTraceMode = false }: SpanDrawerProps) {
  const [selectedTraceId, setSelectedTraceId] = useState<string | null>(null);
  const [spans, setSpans] = useState<SpanResponse[]>([]);
  const [loadingSpans, setLoadingSpans] = useState(false);
  const [selectedSpan, setSelectedSpan] = useState<SpanNode | null>(null);

  // Auto-select first trace when traces load
  useEffect(() => {
    if (traces.length > 0 && !selectedTraceId) {
      setSelectedTraceId(traces[0].trace_id);
    }
  }, [traces, selectedTraceId]);

  // Reset selection when drawer closes
  useEffect(() => {
    if (!isOpen) {
      setSelectedTraceId(null);
      setSpans([]);
      setSelectedSpan(null);
    }
  }, [isOpen]);

  // Load spans when a trace is selected
  useEffect(() => {
    if (!selectedTraceId) { setSpans([]); setSelectedSpan(null); return; }
    setLoadingSpans(true);
    setSelectedSpan(null);
    fetchTrace(selectedTraceId)
      .then(s => setSpans(s))
      .catch(() => setSpans([]))
      .finally(() => setLoadingSpans(false));
  }, [selectedTraceId]);

  // Body scroll lock
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  // Escape key
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      if (selectedSpan) {
        setSelectedSpan(null);
      } else {
        onClose();
      }
    }
  }, [onClose, selectedSpan]);

  useEffect(() => {
    if (isOpen) document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, handleKeyDown]);

  // Build tree
  const flatNodes = useMemo(() => {
    if (spans.length === 0) return [];
    const tree = buildSpanTree(spans);
    const rootDuration = tree[0]?.duration_ms || 1;
    computeSelfTimes(tree, rootDuration);
    return flattenTree(tree);
  }, [spans]);

  const rootSpan = flatNodes[0] || null;
  const { method, path } = extractMethod(resource);
  const selectedTrace = traces.find(t => t.trace_id === selectedTraceId);

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 flex" style={{ zIndex }}>
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-300"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="fixed top-0 right-0 h-full w-[70vw] max-w-[1400px] bg-gray-950 border-l border-gray-800 shadow-2xl flex flex-col animate-in slide-in-from-right duration-300" style={{ zIndex: zIndex + 10 }}>
        {/* ─── Header ─── */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800 bg-gray-900 flex-shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: getServiceColor(serviceName) }} />
            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider flex-shrink-0">{serviceName}</span>
            <span className="text-gray-700 flex-shrink-0">›</span>
            {method && (
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded flex-shrink-0 ${methodColors[method] || 'bg-gray-500/20 text-gray-400'}`}>
                {method}
              </span>
            )}
            <span className="font-mono text-sm text-gray-200 truncate">{path}</span>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-800 rounded-lg text-gray-400 hover:text-white transition-colors flex-shrink-0"
          >
            <X size={18} />
          </button>
        </div>

        {/* ─── Body ─── */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left: Trace List (hidden in singleTraceMode) */}
          {!singleTraceMode && (
          <div className="w-72 flex-shrink-0 border-r border-gray-800 bg-gray-900/50 flex flex-col">
            <div className="px-4 py-3 border-b border-gray-800 text-xs font-bold text-gray-500 uppercase tracking-wider">
              Recent Traces ({traces.length})
            </div>
            <div className="flex-1 overflow-y-auto">
              {loadingTraces ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-5 h-5 animate-spin text-primary" />
                </div>
              ) : traces.length === 0 ? (
                <p className="text-gray-600 text-xs text-center py-8">No recent traces.</p>
              ) : (
                <div className="divide-y divide-gray-800/50">
                  {traces.map(t => (
                    <div
                      key={t.trace_id}
                      onClick={() => { setSelectedTraceId(t.trace_id); setSelectedSpan(null); }}
                      className={`px-4 py-3 cursor-pointer transition-colors ${
                        selectedTraceId === t.trace_id
                          ? 'bg-primary/10 border-l-2 border-l-primary'
                          : 'hover:bg-white/5 border-l-2 border-l-transparent'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="font-mono text-[11px] text-primary/80">{t.trace_id.slice(0, 12)}…</span>
                        {t.error && (
                          <span className="text-[10px] text-red-400 flex items-center gap-0.5">
                            <AlertTriangle size={10} /> ERR
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-[10px] text-gray-500">
                        <span className="flex items-center gap-1">
                          <Clock size={10} /> {formatTimestamp(t.timestamp)}
                        </span>
                        <span className={`font-mono font-bold ${
                          t.duration_ms >= 500 ? 'text-red-400' : t.duration_ms >= 100 ? 'text-amber-400' : 'text-emerald-400'
                        }`}>
                          {formatDuration(t.duration_ms)}
                        </span>
                        <span className="flex items-center gap-0.5">
                          <Layers size={10} /> {t.span_count}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          )}

          {/* Right: Waterfall Table + Detail Panel */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Trace summary bar */}
            {selectedTrace && (
              <div className="px-5 py-3 bg-gray-900/80 border-b border-gray-800 flex items-center gap-6 text-xs text-gray-400 flex-shrink-0">
                <span>Trace: <span className="text-primary font-mono">{selectedTrace.trace_id.slice(0, 16)}…</span></span>
                <span>Duration: <span className="text-white font-bold">{formatDuration(selectedTrace.duration_ms)}</span></span>
                <span>Spans: <span className="text-white font-bold">{selectedTrace.span_count}</span></span>
                <span>{formatTimestamp(selectedTrace.timestamp)}</span>
              </div>
            )}

            {/* Table Header */}
            <div className="flex items-center px-5 py-2.5 bg-gray-900 border-b border-gray-800 text-[10px] font-bold text-gray-500 uppercase tracking-widest flex-shrink-0">
              <div className="flex-1 min-w-0">Service / Operation</div>
              <div className="w-[90px] text-right">Duration</div>
              <div className="w-[90px] text-right">Exec Time</div>
              <div className="w-[100px] text-right">% Exec Time</div>
            </div>

            {/* Table Body */}
            <div className={`overflow-y-auto transition-all duration-300 ${selectedSpan ? 'flex-[1_1_0] min-h-0' : 'flex-1'}`}>
              {loadingSpans ? (
                <div className="flex items-center justify-center py-16">
                  <Loader2 className="w-6 h-6 animate-spin text-primary" />
                </div>
              ) : flatNodes.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-gray-600">
                  <Layers className="w-8 h-8 mb-2 opacity-40" />
                  <p className="text-sm">Select a trace to view spans</p>
                </div>
              ) : (
                flatNodes.map((node, i) => {
                  const durationBarWidth = rootSpan
                    ? Math.max(2, (node.duration_ms / rootSpan.duration_ms) * 100)
                    : 100;
                  const isHighExec = node.execPercent >= 10;
                  const isSelected = selectedSpan?.span_id === node.span_id;

                  return (
                    <div
                      key={`${node.span_id}-${i}`}
                      onClick={() => setSelectedSpan(isSelected ? null : node)}
                      className={`flex items-center px-5 py-2 border-b border-gray-800/30 hover:bg-white/[0.03] transition-colors cursor-pointer group ${
                        node.error > 0 ? 'bg-red-500/[0.03]' : ''
                      } ${isSelected ? 'bg-primary/10 border-l-2 border-l-primary' : 'border-l-2 border-l-transparent'}`}
                    >
                      {/* Service / Operation */}
                      <div className="flex-1 min-w-0 flex items-center gap-2" style={{ paddingLeft: `${node.depth * 20}px` }}>
                        {node.depth > 0 && (
                          <span className="text-gray-700 text-xs flex-shrink-0 font-mono">
                            {i === flatNodes.length - 1 || (flatNodes[i + 1] && flatNodes[i + 1].depth <= node.depth)
                              ? '└─'
                              : '├─'}
                          </span>
                        )}
                        <div
                          className="w-2 h-2 rounded-full flex-shrink-0 ring-1 ring-white/10"
                          style={{ backgroundColor: getServiceColor(node.service) }}
                        />
                        <div className="flex flex-col min-w-0">
                          <span className={`text-xs truncate ${node.error > 0 ? 'text-red-400' : 'text-gray-200'}`}>
                            {node.name}
                          </span>
                          <span className="text-[10px] text-gray-600 truncate">{node.service}</span>
                        </div>
                        <div className="w-20 flex-shrink-0 ml-auto mr-2 hidden lg:block">
                          <div className="w-full h-1.5 bg-gray-800/60 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${node.error > 0 ? 'bg-red-500/70' : ''}`}
                              style={{
                                width: `${Math.min(100, durationBarWidth)}%`,
                                backgroundColor: node.error > 0 ? undefined : getServiceColor(node.service),
                                opacity: 0.7,
                              }}
                            />
                          </div>
                        </div>
                      </div>

                      {/* Duration */}
                      <div className={`w-[90px] text-right font-mono text-xs flex-shrink-0 ${
                        node.duration_ms >= 500 ? 'text-red-400' : node.duration_ms >= 100 ? 'text-amber-400' : 'text-gray-300'
                      }`}>
                        {formatDuration(node.duration_ms)}
                      </div>

                      {/* Exec Time */}
                      <div className={`w-[90px] text-right font-mono text-xs flex-shrink-0 ${
                        isHighExec ? 'text-amber-400 font-bold' : 'text-gray-400'
                      }`}>
                        {formatDuration(node.execTime)}
                      </div>

                      {/* % Exec Time */}
                      <div className={`w-[100px] text-right font-mono text-xs flex-shrink-0 ${
                        isHighExec ? 'text-amber-400 font-bold' : 'text-gray-500'
                      }`}>
                        {formatPercent(node.execPercent)}
                        {node.execPercent >= 50 && <span className="ml-1">⚠️</span>}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* ─── Bottom Span Detail Panel ─── */}
            {selectedSpan && (
              <div className="border-t border-gray-700 bg-gray-900 flex-shrink-0 animate-in slide-in-from-bottom duration-300"
                   style={{ maxHeight: '45%', minHeight: '200px' }}>
                {/* Detail Header */}
                <div className="flex items-center justify-between px-5 py-3 border-b border-gray-800 bg-gray-900 sticky top-0 z-10">
                  <div className="flex items-center gap-3">
                    <Info size={14} className="text-primary" />
                    <span className="text-xs font-bold text-gray-300 uppercase tracking-wider">Span Details</span>
                    <span className="text-[10px] text-gray-600">
                      {selectedSpan.span_id.slice(0, 16)}…
                    </span>
                    {selectedSpan.error > 0 && (
                      <span className="text-[10px] text-red-400 bg-red-500/10 px-2 py-0.5 rounded border border-red-500/20 flex items-center gap-1">
                        <AlertTriangle size={10} /> ERROR
                      </span>
                    )}
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); setSelectedSpan(null); }}
                    className="p-1.5 hover:bg-gray-800 rounded text-gray-500 hover:text-white transition-colors"
                  >
                    <ChevronDown size={14} />
                  </button>
                </div>

                {/* Detail Body */}
                <div className="overflow-y-auto px-5 py-4" style={{ maxHeight: 'calc(100% - 48px)' }}>
                  {/* Core Span Info */}
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
                    <DetailCell label="Service" value={selectedSpan.service} color={getServiceColor(selectedSpan.service)} />
                    <DetailCell label="Operation" value={selectedSpan.name} />
                    <DetailCell label="Resource" value={selectedSpan.resource || 'N/A'} />
                    <DetailCell label="Duration" value={formatDuration(selectedSpan.duration_ms)} />
                    <DetailCell
                      label="Span ID"
                      value={selectedSpan.span_id}
                      icon={<Hash size={10} className="text-gray-600" />}
                      mono
                    />
                    <DetailCell
                      label="Parent ID"
                      value={selectedSpan.parent_id || 'Root Span'}
                      icon={<Hash size={10} className="text-gray-600" />}
                      mono
                    />
                    <DetailCell label="Start Time" value={selectedSpan.timestamp} />
                    <DetailCell label="Exec Time" value={formatDuration(selectedSpan.execTime)} />
                  </div>

                  {/* HTTP Attributes Section */}
                  {isHttpSpan(selectedSpan.attributes) && (
                    <div className="mb-4">
                      <div className="flex items-center gap-2 mb-3">
                        <Globe size={14} className="text-blue-400" />
                        <span className="text-xs font-bold text-gray-300 uppercase tracking-wider">HTTP Details</span>
                      </div>

                      {/* Status Code Badge (large) */}
                      {selectedSpan.attributes['http.status_code'] && (
                        <div className="mb-3">
                          <span className={`inline-flex items-center gap-2 text-sm font-bold px-3 py-1.5 rounded-lg border ${getStatusCodeColor(selectedSpan.attributes['http.status_code'])}`}>
                            {selectedSpan.attributes['http.method'] && (
                              <span className="text-xs opacity-70">{selectedSpan.attributes['http.method']}</span>
                            )}
                            {selectedSpan.attributes['http.status_code']}
                          </span>
                        </div>
                      )}

                      {/* HTTP Attributes Grid */}
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
                        {HTTP_ATTR_KEYS.map(({ key, label, icon }) => {
                          const value = selectedSpan.attributes[key];
                          if (!value || key === 'http.status_code') return null;
                          return (
                            <div key={key} className="flex items-start gap-2 py-1.5 px-3 bg-gray-800/30 rounded-lg">
                              <span className="text-[10px] flex-shrink-0 mt-0.5">{icon}</span>
                              <div className="min-w-0">
                                <span className="text-[10px] text-gray-500 uppercase tracking-wider block">{label}</span>
                                <span className="text-xs text-gray-200 font-mono break-all">{value}</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* All Other Attributes */}
                  {Object.keys(selectedSpan.attributes || {}).length > 0 && (
                    <div>
                      <div className="flex items-center gap-2 mb-3">
                        <Layers size={14} className="text-gray-400" />
                        <span className="text-xs font-bold text-gray-300 uppercase tracking-wider">All Attributes</span>
                        <span className="text-[10px] text-gray-600">({Object.keys(selectedSpan.attributes).length})</span>
                      </div>
                      <div className="bg-gray-800/20 rounded-lg border border-gray-800 overflow-hidden">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="border-b border-gray-800">
                              <th className="text-left py-2 px-3 text-gray-500 font-semibold uppercase text-[10px] tracking-wider w-1/3">Key</th>
                              <th className="text-left py-2 px-3 text-gray-500 font-semibold uppercase text-[10px] tracking-wider">Value</th>
                            </tr>
                          </thead>
                          <tbody>
                            {Object.entries(selectedSpan.attributes).sort(([a], [b]) => a.localeCompare(b)).map(([key, value]) => (
                              <tr key={key} className="border-b border-gray-800/50 hover:bg-white/[0.02]">
                                <td className="py-1.5 px-3 font-mono text-primary/70">{key}</td>
                                <td className="py-1.5 px-3 font-mono text-gray-300 break-all">{value}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Empty state for no attributes */}
                  {Object.keys(selectedSpan.attributes || {}).length === 0 && (
                    <div className="text-center py-6 text-gray-600">
                      <Info className="w-6 h-6 mx-auto mb-2 opacity-30" />
                      <p className="text-xs">No attributes available for this span.</p>
                      <p className="text-[10px] text-gray-700 mt-1">Attributes will be populated after the master-service is restarted to apply the schema migration.</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

// ─── Sub-components ───
function DetailCell({ label, value, color, icon, mono }: {
  label: string;
  value: string;
  color?: string;
  icon?: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="bg-gray-800/30 rounded-lg px-3 py-2">
      <div className="flex items-center gap-1 text-[10px] text-gray-500 uppercase tracking-wider mb-1">
        {icon} {label}
      </div>
      <div
        className={`text-xs break-all ${mono ? 'font-mono' : ''} ${color ? '' : 'text-gray-200'}`}
        style={color ? { color } : undefined}
      >
        {value}
      </div>
    </div>
  );
}
