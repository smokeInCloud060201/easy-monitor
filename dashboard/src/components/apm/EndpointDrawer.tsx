import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  X, Clock, Layers, AlertTriangle, Loader2, ChevronDown, ChevronRight,
  Activity, Server, Zap, TrendingUp,
} from 'lucide-react';
import {
  fetchResourceSummary, searchTraces, fetchTrace,
  type ResourceWithMetrics, type ServiceSummary, type TraceSummary, type SpanResponse,
} from '../../lib/api';
import { SpanDrawer } from './SpanDrawer';

// ─── Props ───
interface EndpointDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  serviceName: string;
  resource: string;
  resourceMetrics: ResourceWithMetrics | null;
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

function formatNum(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return Math.round(n).toString();
}

function formatTimestamp(ts: string): string {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

const methodColors: Record<string, string> = {
  GET: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  POST: 'bg-green-500/20 text-green-400 border-green-500/30',
  PUT: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  DELETE: 'bg-red-500/20 text-red-400 border-red-500/30',
  PATCH: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
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

// ─── Dependency/Span Summary Types ───
interface DependencyInfo {
  service: string;
  callCount: number;
  avgDuration: number;
  errors: number;
}

interface SpanSummaryInfo {
  name: string;
  service: string;
  count: number;
  avgDuration: number;
  totalDuration: number;
  pctOfTotal: number;
}

// ─── Main Component ───
export function EndpointDrawer({ isOpen, onClose, serviceName, resource, resourceMetrics }: EndpointDrawerProps) {
  const [summary, setSummary] = useState<ServiceSummary | null>(null);
  const [traces, setTraces] = useState<TraceSummary[]>([]);
  const [allSpans, setAllSpans] = useState<SpanResponse[]>([]);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [loadingTraces, setLoadingTraces] = useState(false);
  const [loadingSpans, setLoadingSpans] = useState(false);
  const [selectedTraceId, setSelectedTraceId] = useState<string | null>(null);
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});

  // Load endpoint summary + traces when drawer opens
  useEffect(() => {
    if (!isOpen || !resource) return;
    setSummary(null);
    setTraces([]);
    setAllSpans([]);
    setSelectedTraceId(null);

    setLoadingSummary(true);
    fetchResourceSummary(serviceName, resource, '1h')
      .then(s => setSummary(s))
      .catch(() => setSummary(null))
      .finally(() => setLoadingSummary(false));

    setLoadingTraces(true);
    searchTraces({ service: serviceName, resource, limit: 20 })
      .then(r => {
        const t = r.traces || [];
        setTraces(t);
        // Load spans from first 5 traces for dependency/summary analysis
        if (t.length > 0) {
          setLoadingSpans(true);
          const toLoad = t.slice(0, 5);
          Promise.all(toLoad.map(tr => fetchTrace(tr.trace_id)))
            .then(results => setAllSpans(results.flat()))
            .catch(() => setAllSpans([]))
            .finally(() => setLoadingSpans(false));
        }
      })
      .catch(() => setTraces([]))
      .finally(() => setLoadingTraces(false));
  }, [isOpen, resource, serviceName]);

  // Reset on close
  useEffect(() => {
    if (!isOpen) {
      setSelectedTraceId(null);
      setSummary(null);
      setTraces([]);
      setAllSpans([]);
    }
  }, [isOpen]);

  // Body scroll lock
  useEffect(() => {
    if (isOpen) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = '';
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  // Escape key
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      if (selectedTraceId) setSelectedTraceId(null);
      else onClose();
    }
  }, [onClose, selectedTraceId]);

  useEffect(() => {
    if (isOpen) document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, handleKeyDown]);

  // Compute dependencies from loaded spans
  const dependencies = useMemo<DependencyInfo[]>(() => {
    if (allSpans.length === 0) return [];
    const depMap = new Map<string, { calls: number; totalDur: number; errors: number }>();

    for (const span of allSpans) {
      if (span.service !== serviceName) {
        const existing = depMap.get(span.service) || { calls: 0, totalDur: 0, errors: 0 };
        existing.calls++;
        existing.totalDur += span.duration_ms;
        existing.errors += span.error > 0 ? 1 : 0;
        depMap.set(span.service, existing);
      }
    }

    return Array.from(depMap.entries())
      .map(([service, data]) => ({
        service,
        callCount: data.calls,
        avgDuration: data.totalDur / data.calls,
        errors: data.errors,
      }))
      .sort((a, b) => b.callCount - a.callCount);
  }, [allSpans, serviceName]);

  // Compute span summary from loaded spans
  const spanSummary = useMemo<SpanSummaryInfo[]>(() => {
    if (allSpans.length === 0) return [];
    const opMap = new Map<string, { service: string; count: number; totalDur: number }>();
    let grandTotal = 0;

    for (const span of allSpans) {
      const key = `${span.service}::${span.name}`;
      const existing = opMap.get(key) || { service: span.service, count: 0, totalDur: 0 };
      existing.count++;
      existing.totalDur += span.duration_ms;
      grandTotal += span.duration_ms;
      opMap.set(key, existing);
    }

    return Array.from(opMap.entries())
      .map(([name, data]) => ({
        name: name.split('::')[1],
        service: data.service,
        count: data.count,
        avgDuration: data.totalDur / data.count,
        totalDuration: data.totalDur,
        pctOfTotal: grandTotal > 0 ? (data.totalDur / grandTotal) * 100 : 0,
      }))
      .sort((a, b) => b.totalDuration - a.totalDuration)
      .slice(0, 20);
  }, [allSpans]);

  const toggleSection = (key: string) => {
    setCollapsedSections(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const { method, path } = extractMethod(resource);

  // Find selected trace for SpanDrawer
  const selectedTraceSummary = traces.find(t => t.trace_id === selectedTraceId);

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-40 flex">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-300"
        onClick={onClose}
      />

      {/* EndpointDrawer Panel */}
      <div className="fixed top-0 right-0 h-full w-[60vw] max-w-[1200px] bg-gray-950 border-l border-gray-800 shadow-2xl z-50 flex flex-col animate-in slide-in-from-right duration-300">
        {/* ─── Header ─── */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800 bg-gray-900 flex-shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: getServiceColor(serviceName) }} />
            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider flex-shrink-0">{serviceName}</span>
            <span className="text-gray-700 flex-shrink-0">›</span>
            {method && (
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border flex-shrink-0 ${methodColors[method] || 'bg-gray-500/20 text-gray-400 border-gray-500/30'}`}>
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

        {/* ─── Summary Metrics Bar ─── */}
        <div className="px-6 py-3 border-b border-gray-800 bg-gray-900/50 flex-shrink-0">
          {loadingSummary ? (
            <div className="flex items-center gap-2 text-gray-500 text-xs">
              <Loader2 className="w-3 h-3 animate-spin" /> Loading metrics…
            </div>
          ) : (
            <div className="grid grid-cols-4 gap-4">
              <MetricPill
                icon={<Zap size={12} />}
                label="Requests"
                value={formatNum(resourceMetrics?.requests || summary?.total_requests || 0)}
                color="text-blue-400"
              />
              <MetricPill
                icon={<AlertTriangle size={12} />}
                label="Error Rate"
                value={`${(resourceMetrics?.error_rate || 0).toFixed(1)}%`}
                color={(resourceMetrics?.error_rate || 0) < 5 ? 'text-emerald-400' : 'text-red-400'}
              />
              <MetricPill
                icon={<Clock size={12} />}
                label="Avg Latency"
                value={formatDuration(resourceMetrics?.avg_duration_ms || summary?.avg_duration_ms || 0)}
                color="text-amber-400"
              />
              <MetricPill
                icon={<TrendingUp size={12} />}
                label="P95"
                value={formatDuration(resourceMetrics?.p95_duration_ms || summary?.p95_duration_ms || 0)}
                color="text-orange-400"
              />
            </div>
          )}
        </div>

        {/* ─── Scrollable Body ─── */}
        <div className="flex-1 overflow-y-auto">
          {/* ━━━ Section: Dependencies ━━━ */}
          <CollapsibleSection
            title="Dependencies"
            icon={<Server size={14} className="text-cyan-400" />}
            count={dependencies.length}
            collapsed={collapsedSections['deps']}
            onToggle={() => toggleSection('deps')}
          >
            {loadingSpans ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-5 h-5 animate-spin text-primary" />
              </div>
            ) : dependencies.length === 0 ? (
              <p className="text-gray-600 text-xs text-center py-6">No downstream dependencies detected.</p>
            ) : (
              <DependencyGraph
                serviceName={serviceName}
                dependencies={dependencies}
                resource={resource}
              />
            )}
          </CollapsibleSection>

          {/* ━━━ Section: Span Summary ━━━ */}
          <CollapsibleSection
            title="Span Summary"
            icon={<Activity size={14} className="text-violet-400" />}
            count={spanSummary.length}
            collapsed={collapsedSections['spans']}
            onToggle={() => toggleSection('spans')}
          >
            {loadingSpans ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-5 h-5 animate-spin text-primary" />
              </div>
            ) : spanSummary.length === 0 ? (
              <p className="text-gray-600 text-xs text-center py-6">No span data available.</p>
            ) : (
              <div>
                <div className="flex items-center px-5 py-2 border-b border-gray-800 text-[10px] font-bold text-gray-500 uppercase tracking-widest">
                  <div className="flex-1 min-w-0">Operation</div>
                  <div className="w-[100px] text-right">Avg Duration</div>
                  <div className="w-[70px] text-right">Calls</div>
                  <div className="w-[90px] text-right">% of Total</div>
                </div>
                <div className="divide-y divide-gray-800/30">
                  {spanSummary.map((op, i) => (
                    <div key={`${op.service}-${op.name}-${i}`} className="flex items-center px-5 py-2 hover:bg-white/[0.02] transition-colors">
                      <div className="flex-1 min-w-0 flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: getServiceColor(op.service) }} />
                        <div className="min-w-0">
                          <span className="text-xs text-gray-200 truncate block">{op.name}</span>
                          <span className="text-[10px] text-gray-600 truncate block">{op.service}</span>
                        </div>
                      </div>
                      <div className={`w-[100px] text-right font-mono text-xs flex-shrink-0 ${
                        op.avgDuration >= 100 ? 'text-amber-400' : 'text-gray-300'
                      }`}>
                        {formatDuration(op.avgDuration)}
                      </div>
                      <div className="w-[70px] text-right font-mono text-xs text-gray-400 flex-shrink-0">
                        {op.count}
                      </div>
                      <div className="w-[90px] text-right flex-shrink-0">
                        <div className="flex items-center justify-end gap-2">
                          <div className="w-12 h-1.5 bg-gray-800/60 rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full"
                              style={{
                                width: `${Math.min(100, op.pctOfTotal)}%`,
                                backgroundColor: getServiceColor(op.service),
                                opacity: 0.7,
                              }}
                            />
                          </div>
                          <span className={`font-mono text-[10px] ${op.pctOfTotal >= 20 ? 'text-amber-400 font-bold' : 'text-gray-500'}`}>
                            {op.pctOfTotal.toFixed(1)}%
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CollapsibleSection>

          {/* ━━━ Section: Traces ━━━ */}
          <CollapsibleSection
            title="Traces"
            icon={<Layers size={14} className="text-primary" />}
            count={traces.length}
            collapsed={collapsedSections['traces']}
            onToggle={() => toggleSection('traces')}
          >
            {loadingTraces ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-5 h-5 animate-spin text-primary" />
              </div>
            ) : traces.length === 0 ? (
              <p className="text-gray-600 text-xs text-center py-6">No recent traces for this endpoint.</p>
            ) : (
              <div className="divide-y divide-gray-800/50">
                {traces.map(t => (
                  <div
                    key={t.trace_id}
                    onClick={() => setSelectedTraceId(t.trace_id)}
                    className={`flex items-center gap-4 px-5 py-3 cursor-pointer transition-colors ${
                      selectedTraceId === t.trace_id
                        ? 'bg-primary/10 border-l-2 border-l-primary'
                        : 'hover:bg-white/5 border-l-2 border-l-transparent'
                    }`}
                  >
                    <ChevronRight className="w-3.5 h-3.5 text-gray-600 flex-shrink-0" />
                    <div className="flex-1 min-w-0 flex items-center gap-3">
                      <span className="font-mono text-[11px] text-primary/80 flex-shrink-0">{t.trace_id.slice(0, 12)}…</span>
                      <span className="text-xs text-gray-400 flex items-center gap-1 flex-shrink-0">
                        <Clock size={11} /> {formatTimestamp(t.timestamp)}
                      </span>
                      <span className={`text-xs font-mono font-bold flex-shrink-0 ${
                        t.duration_ms >= 500 ? 'text-red-400' : t.duration_ms >= 100 ? 'text-amber-400' : 'text-emerald-400'
                      }`}>
                        {formatDuration(t.duration_ms)}
                      </span>
                      <span className="text-xs text-gray-500 flex items-center gap-1 flex-shrink-0">
                        <Layers size={11} /> {t.span_count}
                      </span>
                      {t.error && (
                        <span className="text-[10px] text-red-400 bg-red-500/10 px-1.5 py-0.5 rounded border border-red-500/20 flex items-center gap-0.5">
                          <AlertTriangle size={10} /> Error
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-gray-600 truncate max-w-[200px]">{t.root_name}</span>
                  </div>
                ))}
              </div>
            )}
          </CollapsibleSection>
        </div>
      </div>

      {/* ─── Level 2: SpanDrawer (on top) ─── */}
      <SpanDrawer
        isOpen={selectedTraceId !== null}
        onClose={() => setSelectedTraceId(null)}
        serviceName={serviceName}
        resource={resource}
        traces={selectedTraceSummary ? [selectedTraceSummary] : []}
        loadingTraces={false}
        zIndex={60}
        singleTraceMode
      />
    </div>,
    document.body
  );
}

// ─── DependencyGraph (Canvas) ───

function DependencyGraph({ serviceName, dependencies, resource }: {
  serviceName: string;
  dependencies: DependencyInfo[];
  resource: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Hi-DPI
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);
    const W = rect.width;
    const H = rect.height;

    // ─── Layout Constants ───
    const NODE_W = 170;
    const NODE_H = 62;
    const NODE_RADIUS = 8;
    const FONT_SMALL = '9px Inter, -apple-system, sans-serif';
    const FONT_BOLD = 'bold 11px Inter, -apple-system, sans-serif';

    // Source node (current service) — center-left
    const srcX = 40;
    const srcY = H / 2 - NODE_H / 2;

    // Destination nodes — right side, distributed vertically
    const depCount = dependencies.length;
    const rightX = W - NODE_W - 40;
    const totalH = depCount * NODE_H + (depCount - 1) * 16;
    const startY = Math.max(10, (H - totalH) / 2);

    function roundedRect(x: number, y: number, w: number, h: number, r: number) {
      ctx!.beginPath();
      ctx!.moveTo(x + r, y);
      ctx!.lineTo(x + w - r, y);
      ctx!.arcTo(x + w, y, x + w, y + r, r);
      ctx!.lineTo(x + w, y + h - r);
      ctx!.arcTo(x + w, y + h, x + w - r, y + h, r);
      ctx!.lineTo(x + r, y + h);
      ctx!.arcTo(x, y + h, x, y + h - r, r);
      ctx!.lineTo(x, y + r);
      ctx!.arcTo(x, y, x + r, y, r);
      ctx!.closePath();
    }

    function drawNode(x: number, y: number, name: string, subtitle: string, color: string, isSource: boolean) {
      // Glow effect
      ctx!.shadowColor = color + '44';
      ctx!.shadowBlur = 12;
      ctx!.shadowOffsetX = 0;
      ctx!.shadowOffsetY = 0;

      // Background
      roundedRect(x, y, NODE_W, NODE_H, NODE_RADIUS);
      ctx!.fillStyle = '#111827';
      ctx!.fill();

      // Border
      ctx!.strokeStyle = isSource ? '#6366f1' : color;
      ctx!.lineWidth = isSource ? 2 : 1.5;
      ctx!.stroke();

      // Reset shadow
      ctx!.shadowColor = 'transparent';
      ctx!.shadowBlur = 0;

      // Color indicator bar (left side)
      const barW = 4;
      ctx!.beginPath();
      ctx!.moveTo(x + NODE_RADIUS, y);
      ctx!.lineTo(x + barW, y);
      ctx!.lineTo(x + barW, y + NODE_H);
      ctx!.lineTo(x + NODE_RADIUS, y + NODE_H);
      ctx!.arcTo(x, y + NODE_H, x, y + NODE_H - NODE_RADIUS, NODE_RADIUS);
      ctx!.lineTo(x, y + NODE_RADIUS);
      ctx!.arcTo(x, y, x + NODE_RADIUS, y, NODE_RADIUS);
      ctx!.closePath();
      ctx!.fillStyle = color;
      ctx!.fill();

      // Service name
      ctx!.font = FONT_BOLD;
      ctx!.fillStyle = '#e5e7eb';
      ctx!.textBaseline = 'top';
      const displayName = name.length > 18 ? name.slice(0, 17) + '…' : name;
      ctx!.fillText(displayName, x + 12, y + 10);

      // Subtitle
      ctx!.font = FONT_SMALL;
      ctx!.fillStyle = '#6b7280';
      const displaySub = subtitle.length > 26 ? subtitle.slice(0, 25) + '…' : subtitle;
      ctx!.fillText(displaySub, x + 12, y + 27);

      // Type badge
      if (isSource) {
        ctx!.font = FONT_SMALL;
        ctx!.fillStyle = '#818cf8';
        ctx!.fillText('● source', x + 12, y + 43);
      }
    }

    function drawDepNode(x: number, y: number, dep: DependencyInfo) {
      const color = getServiceColor(dep.service);
      drawNode(x, y, dep.service, '', color, false);

      // Stats line: calls · avg · errors
      const c = ctx!;
      c.font = FONT_SMALL;
      c.textBaseline = 'top';
      let statX = x + 12;

      // Calls
      c.fillStyle = '#9ca3af';
      c.fillText(`${dep.callCount} calls`, statX, y + 28);
      statX += c.measureText(`${dep.callCount} calls`).width + 8;

      // Avg duration
      c.fillStyle = dep.avgDuration >= 100 ? '#fbbf24' : '#6b7280';
      const durStr = formatDuration(dep.avgDuration);
      c.fillText(durStr, statX, y + 28);
      statX += c.measureText(durStr).width + 8;

      // Errors
      if (dep.errors > 0) {
        c.fillStyle = '#f87171';
        c.fillText(`${dep.errors} err`, statX, y + 28);
      }

      // Health indicator dot
      c.beginPath();
      c.arc(x + NODE_W - 12, y + 12, 4, 0, Math.PI * 2);
      c.fillStyle = dep.errors > 0 ? '#ef4444' : '#22c55e';
      c.fill();
    }

    let dashOffset = 0;

    function draw() {
      ctx!.clearRect(0, 0, W, H);

      // ─── Draw edges ───
      dependencies.forEach((dep, i) => {
        const depY = startY + i * (NODE_H + 16);
        const fromX = srcX + NODE_W;
        const fromY = srcY + NODE_H / 2;
        const toX = rightX;
        const toY = depY + NODE_H / 2;

        // Bezier curve
        const cpOffset = Math.min(120, (rightX - srcX - NODE_W) * 0.4);
        const color = getServiceColor(dep.service);

        ctx!.beginPath();
        ctx!.moveTo(fromX, fromY);
        ctx!.bezierCurveTo(fromX + cpOffset, fromY, toX - cpOffset, toY, toX, toY);
        ctx!.strokeStyle = color + '40';
        ctx!.lineWidth = Math.max(1.5, Math.min(4, Math.log2(dep.callCount + 1)));
        ctx!.setLineDash([6, 4]);
        ctx!.lineDashOffset = -dashOffset;
        ctx!.stroke();
        ctx!.setLineDash([]);

        // Arrowhead
        const arrowSize = 6;
        const angle = Math.atan2(toY - (toY * 0.25 + fromY * 0.75), toX - (toX * 0.25 + (fromX + cpOffset) * 0.75));
        ctx!.beginPath();
        ctx!.moveTo(toX, toY);
        ctx!.lineTo(toX - arrowSize * Math.cos(angle - 0.4), toY - arrowSize * Math.sin(angle - 0.4));
        ctx!.lineTo(toX - arrowSize * Math.cos(angle + 0.4), toY - arrowSize * Math.sin(angle + 0.4));
        ctx!.closePath();
        ctx!.fillStyle = color + '80';
        ctx!.fill();

        // Edge label (call count)
        const midX = (fromX + toX) / 2;
        const midY = (fromY + toY) / 2 - 8;
        ctx!.font = FONT_SMALL;
        ctx!.fillStyle = '#6b728080';
        ctx!.textAlign = 'center';
        ctx!.textBaseline = 'middle';
        ctx!.fillText(`${dep.callCount}×`, midX, midY);
        ctx!.textAlign = 'left';
      });

      // ─── Draw source node ───
      const sourceColor = getServiceColor(serviceName);
      const { method: m, path: p } = extractMethod(resource);
      const srcLabel = m ? `${m} ${p}` : p;
      drawNode(srcX, srcY, serviceName, srcLabel, sourceColor, true);

      // ─── Draw dep nodes ───
      dependencies.forEach((dep, i) => {
        const depY = startY + i * (NODE_H + 16);
        drawDepNode(rightX, depY, dep);
      });

      dashOffset += 0.3;
      animRef.current = requestAnimationFrame(draw);
    }

    draw();
    return () => cancelAnimationFrame(animRef.current);
  }, [serviceName, dependencies, resource]);

  // Compute canvas height based on number of deps
  const canvasH = Math.max(140, dependencies.length * 78 + 40);

  return (
    <div className="px-2 py-2" style={{ height: canvasH }}>
      <canvas
        ref={canvasRef}
        style={{ width: '100%', height: '100%' }}
        className="rounded-lg"
      />
    </div>
  );
}

// ─── Sub-components ───

function MetricPill({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string; color: string }) {
  return (
    <div className="bg-gray-800/40 rounded-lg px-3 py-2.5 border border-gray-800">
      <div className={`flex items-center gap-1.5 mb-1 ${color}`}>
        {icon}
        <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">{label}</span>
      </div>
      <p className="text-lg font-bold font-mono">{value}</p>
    </div>
  );
}

function CollapsibleSection({ title, icon, count, collapsed, onToggle, children }: {
  title: string;
  icon: React.ReactNode;
  count: number;
  collapsed?: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="border-b border-gray-800">
      <button
        onClick={onToggle}
        className="flex items-center gap-3 w-full px-5 py-3 hover:bg-white/[0.02] transition-colors text-left"
      >
        <ChevronDown
          size={14}
          className={`text-gray-500 transition-transform ${collapsed ? '-rotate-90' : ''}`}
        />
        {icon}
        <span className="text-xs font-bold text-gray-300 uppercase tracking-wider">{title}</span>
        <span className="bg-white/10 text-gray-400 text-[10px] px-2 py-0.5 rounded-full">{count}</span>
      </button>
      {!collapsed && (
        <div className="pb-2">
          {children}
        </div>
      )}
    </div>
  );
}
