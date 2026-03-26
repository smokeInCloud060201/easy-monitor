import { useRef, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import type { ServiceDependencies, ServiceDependencyItem } from '../../lib/api';

interface DependencyMiniMapProps {
  data: ServiceDependencies;
  currentService: string;
  healthStatus: 'healthy' | 'degraded';
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

// ─── Canvas Graph ───
export function DependencyMiniMap({ data, currentService, healthStatus }: DependencyMiniMapProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);
  const nodeRectsRef = useRef<{ x: number; y: number; w: number; h: number; service: string }[]>([]);
  const navigate = useNavigate();

  const upstream = useMemo(() => data.upstream || [], [data.upstream]);
  const downstream = useMemo(() => data.downstream || [], [data.downstream]);
  const maxSide = Math.max(upstream.length, downstream.length, 1);
  const canvasH = Math.max(200, maxSide * 78 + 60);

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

    // ─── Layout ───
    const NODE_W = 170;
    const NODE_H = 62;
    const NODE_R = 8;
    const CENTER_W = 180;
    const CENTER_H = 70;
    const FONT_SMALL = '9px Inter, -apple-system, sans-serif';
    const FONT_BOLD = 'bold 11px Inter, -apple-system, sans-serif';
    const FONT_TITLE = 'bold 13px Inter, -apple-system, sans-serif';

    // Center node
    const centerX = W / 2 - CENTER_W / 2;
    const centerY = H / 2 - CENTER_H / 2;

    // Upstream positions (left side)
    const upX = 30;
    const upTotalH = upstream.length * NODE_H + (upstream.length - 1) * 16;
    const upStartY = Math.max(10, (H - upTotalH) / 2);

    // Downstream positions (right side)
    const dnX = W - NODE_W - 30;
    const dnTotalH = downstream.length * NODE_H + (downstream.length - 1) * 16;
    const dnStartY = Math.max(10, (H - dnTotalH) / 2);

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

    function drawServiceNode(x: number, y: number, w: number, h: number, dep: ServiceDependencyItem, isCenter: boolean) {
      const color = isCenter
        ? (healthStatus === 'healthy' ? '#22c55e' : '#ef4444')
        : getServiceColor(dep.service);

      // Glow
      ctx!.shadowColor = color + '44';
      ctx!.shadowBlur = isCenter ? 16 : 10;

      // Background
      roundedRect(x, y, w, h, NODE_R);
      ctx!.fillStyle = isCenter ? '#0f172a' : '#111827';
      ctx!.fill();

      // Border
      ctx!.strokeStyle = color;
      ctx!.lineWidth = isCenter ? 2.5 : 1.5;
      ctx!.stroke();

      // Reset shadow
      ctx!.shadowColor = 'transparent';
      ctx!.shadowBlur = 0;

      // Left color bar
      const barW = 4;
      ctx!.beginPath();
      ctx!.moveTo(x + NODE_R, y);
      ctx!.lineTo(x + barW, y);
      ctx!.lineTo(x + barW, y + h);
      ctx!.lineTo(x + NODE_R, y + h);
      ctx!.arcTo(x, y + h, x, y + h - NODE_R, NODE_R);
      ctx!.lineTo(x, y + NODE_R);
      ctx!.arcTo(x, y, x + NODE_R, y, NODE_R);
      ctx!.closePath();
      ctx!.fillStyle = color;
      ctx!.fill();

      // Service name
      ctx!.font = isCenter ? FONT_TITLE : FONT_BOLD;
      ctx!.fillStyle = '#e5e7eb';
      ctx!.textBaseline = 'top';
      ctx!.textAlign = 'left';
      const maxTextW = w - 32;
      const name = dep.service;
      const displayName = ctx!.measureText(name).width > maxTextW
        ? name.slice(0, Math.floor(maxTextW / 7)) + '…' : name;
      ctx!.fillText(displayName, x + 12, y + (isCenter ? 12 : 10));

      if (isCenter) {
        // Center badge
        ctx!.font = FONT_SMALL;
        ctx!.fillStyle = color;
        ctx!.fillText(healthStatus === 'healthy' ? '● healthy' : '● degraded', x + 12, y + 32);
        // Stats
        ctx!.fillStyle = '#6b7280';
        ctx!.fillText(`${upstream.length} upstream · ${downstream.length} downstream`, x + 12, y + 48);
      } else {
        // Stats line
        ctx!.font = FONT_SMALL;
        let sx = x + 12;

        ctx!.fillStyle = '#9ca3af';
        const reqStr = `${formatNum(dep.requests)} req`;
        ctx!.fillText(reqStr, sx, y + 28);
        sx += ctx!.measureText(reqStr).width + 8;

        ctx!.fillStyle = dep.avg_duration_ms >= 100 ? '#fbbf24' : '#6b7280';
        const durStr = formatDuration(dep.avg_duration_ms);
        ctx!.fillText(durStr, sx, y + 28);
        sx += ctx!.measureText(durStr).width + 8;

        if (dep.error_rate > 0) {
          ctx!.fillStyle = '#f87171';
          ctx!.fillText(`${dep.error_rate.toFixed(0)}% err`, sx, y + 28);
        }

        // Direction badge
        ctx!.fillStyle = dep.direction === 'upstream' ? '#38bdf8' : '#a78bfa';
        ctx!.fillText(dep.direction === 'upstream' ? '↗ upstream' : '↘ downstream', x + 12, y + 43);

        // Health dot
        ctx!.beginPath();
        ctx!.arc(x + w - 12, y + 12, 4, 0, Math.PI * 2);
        ctx!.fillStyle = dep.error_rate > 5 ? '#ef4444' : '#22c55e';
        ctx!.fill();
      }
    }

    function drawEdge(fromX: number, fromY: number, toX: number, toY: number, color: string, requests: number, dashOff: number) {
      const cpOffset = Math.min(100, Math.abs(toX - fromX) * 0.35);

      ctx!.beginPath();
      ctx!.moveTo(fromX, fromY);
      ctx!.bezierCurveTo(fromX + (toX > fromX ? cpOffset : -cpOffset), fromY,
                          toX + (toX > fromX ? -cpOffset : cpOffset), toY,
                          toX, toY);
      ctx!.strokeStyle = color + '40';
      ctx!.lineWidth = Math.max(1.5, Math.min(4, Math.log2(requests + 1)));
      ctx!.setLineDash([6, 4]);
      ctx!.lineDashOffset = -dashOff;
      ctx!.stroke();
      ctx!.setLineDash([]);

      // Arrowhead
      const arrowSize = 6;
      const dir = toX > fromX ? 1 : -1;
      ctx!.beginPath();
      ctx!.moveTo(toX, toY);
      ctx!.lineTo(toX - dir * arrowSize, toY - arrowSize * 0.5);
      ctx!.lineTo(toX - dir * arrowSize, toY + arrowSize * 0.5);
      ctx!.closePath();
      ctx!.fillStyle = color + '80';
      ctx!.fill();

      // Label
      const midX = (fromX + toX) / 2;
      const midY = (fromY + toY) / 2 - 8;
      ctx!.font = FONT_SMALL;
      ctx!.fillStyle = '#6b728080';
      ctx!.textAlign = 'center';
      ctx!.textBaseline = 'middle';
      ctx!.fillText(`${formatNum(requests)}`, midX, midY);
      ctx!.textAlign = 'left';
    }

    let dashOffset = 0;

    function draw() {
      ctx!.clearRect(0, 0, W, H);

      // ─── Upstream edges (left → center) ───
      upstream.forEach((dep: ServiceDependencyItem, i: number) => {
        const depY = upStartY + i * (NODE_H + 16);
        const fromX = upX + NODE_W;
        const fromY = depY + NODE_H / 2;
        const toX = centerX;
        const toY = centerY + CENTER_H / 2;
        drawEdge(fromX, fromY, toX, toY, getServiceColor(dep.service), dep.requests, dashOffset);
      });

      // ─── Downstream edges (center → right) ───
      downstream.forEach((dep: ServiceDependencyItem, i: number) => {
        const depY = dnStartY + i * (NODE_H + 16);
        const fromX = centerX + CENTER_W;
        const fromY = centerY + CENTER_H / 2;
        const toX = dnX;
        const toY = depY + NODE_H / 2;
        drawEdge(fromX, fromY, toX, toY, getServiceColor(dep.service), dep.requests, dashOffset);
      });

      // ─── Build hit-boxes & draw nodes ───
      const rects: { x: number; y: number; w: number; h: number; service: string }[] = [];

      // Center node
      const centerDep: ServiceDependencyItem = {
        service: currentService,
        direction: 'downstream',
        requests: 0,
        error_rate: 0,
        avg_duration_ms: 0,
      };
      drawServiceNode(centerX, centerY, CENTER_W, CENTER_H, centerDep, true);

      // Upstream nodes
      upstream.forEach((dep: ServiceDependencyItem, i: number) => {
        const depY = upStartY + i * (NODE_H + 16);
        drawServiceNode(upX, depY, NODE_W, NODE_H, dep, false);
        rects.push({ x: upX, y: depY, w: NODE_W, h: NODE_H, service: dep.service });
      });

      // Downstream nodes
      downstream.forEach((dep: ServiceDependencyItem, i: number) => {
        const depY = dnStartY + i * (NODE_H + 16);
        drawServiceNode(dnX, depY, NODE_W, NODE_H, dep, false);
        rects.push({ x: dnX, y: depY, w: NODE_W, h: NODE_H, service: dep.service });
      });

      nodeRectsRef.current = rects;

      dashOffset += 0.3;
      animRef.current = requestAnimationFrame(draw);
    }

    draw();
    return () => cancelAnimationFrame(animRef.current);
  }, [data, currentService, healthStatus, upstream, downstream]);

  // ─── Click handler ───
  const handleCanvasClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    for (const nr of nodeRectsRef.current) {
      if (mx >= nr.x && mx <= nr.x + nr.w && my >= nr.y && my <= nr.y + nr.h) {
        navigate(`/apm/services/${encodeURIComponent(nr.service)}`);
        return;
      }
    }
  }, [navigate]);

  // ─── Pointer cursor on hover ───
  const handleCanvasMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    let overNode = false;
    for (const nr of nodeRectsRef.current) {
      if (mx >= nr.x && mx <= nr.x + nr.w && my >= nr.y && my <= nr.y + nr.h) {
        overNode = true;
        break;
      }
    }
    canvas.style.cursor = overNode ? 'pointer' : 'default';
  }, []);

  return (
    <div className="glass-panel p-4 shadow-xl">
      <h3 className="text-sm font-bold text-text-secondary uppercase tracking-wider mb-3">Dependencies</h3>
      {upstream.length === 0 && downstream.length === 0 ? (
        <p className="text-text-muted text-xs text-center py-8">No dependencies detected.</p>
      ) : (
        <div style={{ height: canvasH }}>
          <canvas
            ref={canvasRef}
            onClick={handleCanvasClick}
            onMouseMove={handleCanvasMove}
            style={{ width: '100%', height: '100%' }}
            className="rounded-lg"
          />
        </div>
      )}
    </div>
  );
}
