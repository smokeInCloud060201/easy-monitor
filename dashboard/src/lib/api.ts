export interface SystemMetricPoint {
  time: string;
  cpu: number;
  ram: number;
}

export async function fetchMetrics(from: string, to: string): Promise<SystemMetricPoint[]> {
  try {
    const res = await fetch(`http://localhost:3000/api/v1/system/metrics?from=${from}&to=${to}`);
    if (!res.ok) throw new Error('Failed to fetch metrics');
    return res.json();
  } catch (err) {
    console.error(err);
    return [];
  }
}

export interface LogLineResponse {
  trace_id: string;
  service: string;
  message: string;
}

export async function fetchLogs(_from: string, _to: string, query: string = ''): Promise<LogLineResponse[]> {
  try {
    const res = await fetch(`http://localhost:3000/api/v1/logs/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ keyword: query, service: 'all', limit: 500 })
    });
    if (!res.ok) throw new Error('Failed to fetch logs');
    const data = await res.json();
    return data.logs || [];
  } catch (err) {
    console.error(err);
    return [];
  }
}

export interface SpanResponse {
  trace_id: string;
  span_id: string;
  parent_id: string | null;
  name: string;
  service: string;
  timestamp: string;
  duration_ms: number;
}

export async function fetchTrace(traceId: string): Promise<SpanResponse[]> {
  try {
    const res = await fetch(`http://localhost:3000/api/v1/traces/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ trace_id: traceId })
    });
    if (!res.ok) throw new Error('Failed to fetch trace');
    const data = await res.json();
    return data.spans || [];
  } catch (err) {
    console.error(err);
    return [];
  }
}
