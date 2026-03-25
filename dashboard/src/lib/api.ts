const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000';

function getAuthHeaders(): HeadersInit {
  const token = localStorage.getItem('auth_token');
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

async function apiFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const res = await fetch(`${API_BASE}${url}`, {
    ...options,
    headers: { ...getAuthHeaders(), ...(options.headers || {}) },
  });
  if (res.status === 401) {
    localStorage.removeItem('auth_token');
    window.location.href = '/login';
    throw new Error('Unauthorized');
  }
  return res;
}

// Auth API
export async function loginApi(username: string, password: string): Promise<{ token: string }> {
  const res = await fetch(`${API_BASE}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  if (!res.ok) throw new Error('Invalid credentials');
  return res.json();
}

// System Metrics
export interface SystemMetricPoint {
  time: string;
  cpu: number;
  ram: number;
}

export async function fetchMetrics(from: string, to: string): Promise<SystemMetricPoint[]> {
  try {
    const res = await apiFetch(`/api/v1/system/metrics?from=${from}&to=${to}`);
    if (!res.ok) throw new Error('Failed to fetch metrics');
    return res.json();
  } catch (err) {
    console.error(err);
    return [];
  }
}

// Logs (GrayLog-style)
/** @deprecated Use LogLine instead */
export interface LogLineResponse {
  trace_id: string;
  service: string;
  message: string;
}

export interface LogLine {
  trace_id: string;
  span_id: string;
  service: string;
  level: string;
  message: string;
  pod_id: string;
  namespace: string;
  node_name: string;
  host: string;
  source: string;
  attributes: Record<string, string>;
  timestamp: string;
  timestamp_ms: number;
}

export interface LogsResponse {
  logs: LogLine[];
  total: number;
}

export interface HistogramBucket {
  timestamp: number;
  count: number;
  error_count: number;
  warn_count: number;
}


/** @deprecated Use fetchLogsEnhanced instead */
export async function fetchLogs(_from: string, _to: string, query: string = ''): Promise<LogLineResponse[]> {
  try {
    const res = await apiFetch(`/api/v1/logs/query`, {
      method: 'POST',
      body: JSON.stringify({ keyword: query, service: 'all', limit: 500 }),
    });
    if (!res.ok) throw new Error('Failed to fetch logs');
    const data = await res.json();
    return data.logs || [];
  } catch (err) {
    console.error(err);
    return [];
  }
}

export async function fetchLogsEnhanced(filters: {
  keyword?: string;
  service?: string;
  level?: string;
  pod_id?: string;
  trace_id?: string;
  host?: string;
  source?: string;
  namespace?: string;
  node_name?: string;
  from_ts?: number;
  to_ts?: number;
  limit?: number;
  offset?: number;
}): Promise<LogsResponse> {
  try {
    const res = await apiFetch('/api/v1/logs/query', {
      method: 'POST',
      body: JSON.stringify(filters),
    });
    if (!res.ok) throw new Error('Failed to fetch logs');
    return res.json();
  } catch (err) {
    console.error(err);
    return { logs: [], total: 0 };
  }
}

export async function fetchLogHistogram(filters: {
  service?: string;
  level?: string;
  keyword?: string;
  host?: string;
  source?: string;
  namespace?: string;
  from_ts?: number;
  to_ts?: number;
  interval?: string;
}): Promise<HistogramBucket[]> {
  try {
    const res = await apiFetch('/api/v1/logs/histogram', {
      method: 'POST',
      body: JSON.stringify(filters),
    });
    if (!res.ok) throw new Error('Failed to fetch histogram');
    const data = await res.json();
    return data.buckets || [];
  } catch (err) {
    console.error(err);
    return [];
  }
}



// Service Map
export interface ServiceMapNode {
  service: string;
  total_requests: number;
  error_rate: number;
  avg_duration_ms: number;
  p95_duration_ms: number;
  status: 'healthy' | 'warning' | 'error';
  node_type: 'service' | 'database' | 'external' | 'cache';
}

export interface ServiceMapEdge {
  source: string;
  target: string;
  requests: number;
  error_rate: number;
  avg_duration_ms: number;
}

export interface ServiceMapResponse {
  nodes: ServiceMapNode[];
  edges: ServiceMapEdge[];
}

export async function fetchServiceMap(from?: string): Promise<ServiceMapResponse> {
  try {
    const params = from ? `?from=${from}` : '';
    const res = await apiFetch(`/api/v1/apm/service-map${params}`);
    if (!res.ok) throw new Error('Failed to fetch service map');
    return res.json();
  } catch (err) {
    console.error(err);
    return { nodes: [], edges: [] };
  }
}

// APM Latency & Dependencies
export interface LatencyBucket {
  range_label: string;
  min_ms: number;
  max_ms: number;
  count: number;
  percentage: number;
}

export interface LatencyDistribution {
  service: string;
  buckets: LatencyBucket[];
  total_requests: number;
  p50_ms: number;
  p90_ms: number;
  p95_ms: number;
  p99_ms: number;
}

export interface ServiceDependencyItem {
  service: string;
  direction: 'upstream' | 'downstream';
  requests: number;
  error_rate: number;
  avg_duration_ms: number;
}

export interface ServiceDependencies {
  service: string;
  upstream: ServiceDependencyItem[];
  downstream: ServiceDependencyItem[];
}

export async function fetchLatencyDistribution(service: string, from?: string): Promise<LatencyDistribution> {
  try {
    const params = from ? `?from=${from}` : '';
    const res = await apiFetch(`/api/v1/apm/services/${encodeURIComponent(service)}/latency-distribution${params}`);
    if (!res.ok) throw new Error('Failed');
    return res.json();
  } catch (err) {
    console.error(err);
    return { service, buckets: [], total_requests: 0, p50_ms: 0, p90_ms: 0, p95_ms: 0, p99_ms: 0 };
  }
}

export async function fetchServiceDependencies(service: string, from?: string): Promise<ServiceDependencies> {
  try {
    const params = from ? `?from=${from}` : '';
    const res = await apiFetch(`/api/v1/apm/services/${encodeURIComponent(service)}/dependencies${params}`);
    if (!res.ok) throw new Error('Failed');
    return res.json();
  } catch (err) {
    console.error(err);
    return { service, upstream: [], downstream: [] };
  }
}

// Traces
export interface SpanResponse {
  trace_id: string;
  span_id: string;
  parent_id: string | null;
  name: string;
  service: string;
  resource: string;
  error: number;
  timestamp: string;
  duration_ms: number;
  attributes: Record<string, string>;
}

export async function fetchTrace(traceId: string): Promise<SpanResponse[]> {
  try {
    const res = await apiFetch(`/api/v1/traces/query`, {
      method: 'POST',
      body: JSON.stringify({ trace_id: traceId }),
    });
    if (!res.ok) throw new Error('Failed to fetch trace');
    const data = await res.json();
    return data.spans || [];
  } catch (err) {
    console.error(err);
    return [];
  }
}

// ─── APM API ───

export interface RedTimePoint {
  timestamp: number;
  requests: number;
  errors: number;
  avg_duration: number;
  p95_duration: number;
  p99_duration: number;
}

export interface ServiceSummary {
  service: string;
  total_requests: number;
  total_errors: number;
  avg_duration_ms: number;
  p95_duration_ms: number;
  p99_duration_ms: number;
  timeseries: RedTimePoint[];
}

export interface ResourceWithMetrics {
  resource: string;
  requests: number;
  errors: number;
  avg_duration_ms: number;
  p95_duration_ms: number;
  error_rate: number;
}

export interface TraceSummary {
  trace_id: string;
  root_service: string;
  root_name: string;
  duration_ms: number;
  span_count: number;
  error: boolean;
  timestamp: string;
}

export interface TraceSearchResponse {
  traces: TraceSummary[];
  total: number;
}

export interface ErrorEntry {
  name: string;
  resource: string;
  count: number;
  last_seen: string;
}

export async function fetchServices(): Promise<string[]> {
  try {
    const res = await apiFetch('/api/v1/apm/services');
    if (!res.ok) throw new Error('Failed to fetch services');
    const data = await res.json();
    return data.services || [];
  } catch (err) {
    console.error(err);
    return [];
  }
}

export async function fetchServiceSummary(service: string, from: string = '1h'): Promise<ServiceSummary> {
  const res = await apiFetch(`/api/v1/apm/services/${service}/summary?from=${from}`);
  if (!res.ok) throw new Error('Failed to fetch service summary');
  return res.json();
}

export async function fetchResourcesWithMetrics(service: string): Promise<ResourceWithMetrics[]> {
  const res = await apiFetch(`/api/v1/apm/services/${service}/resources`);
  if (!res.ok) throw new Error('Failed to fetch resources');
  const data = await res.json();
  return data.resources || [];
}

export async function fetchResourceSummary(service: string, resource: string, from: string = '1h'): Promise<ServiceSummary> {
  const res = await apiFetch(`/api/v1/apm/services/${service}/resources/${encodeURIComponent(resource)}/summary?from=${from}`);
  if (!res.ok) throw new Error('Failed to fetch resource summary');
  return res.json();
}

export async function searchTraces(filters: {
  service?: string;
  resource?: string;
  status?: string;
  min_duration_ms?: number;
  max_duration_ms?: number;
  limit?: number;
  offset?: number;
}): Promise<TraceSearchResponse> {
  const res = await apiFetch('/api/v1/traces/search', {
    method: 'POST',
    body: JSON.stringify(filters),
  });
  if (!res.ok) throw new Error('Failed to search traces');
  return res.json();
}

export async function fetchServiceErrors(service: string): Promise<ErrorEntry[]> {
  const res = await apiFetch(`/api/v1/apm/services/${service}/errors`);
  if (!res.ok) throw new Error('Failed to fetch errors');
  const data = await res.json();
  return data.errors || [];
}

// Admin API
export interface UserInfo {
  id: string;
  username: string;
  role: string;
  created_at: number;
}

export async function fetchUsers(): Promise<UserInfo[]> {
  const res = await apiFetch('/api/v1/admin/users');
  if (!res.ok) throw new Error('Failed to fetch users');
  return res.json();
}

export async function createUserApi(username: string, password: string, role: string): Promise<UserInfo> {
  const res = await apiFetch('/api/v1/admin/users', {
    method: 'POST',
    body: JSON.stringify({ username, password, role }),
  });
  if (!res.ok) throw new Error('Failed to create user');
  return res.json();
}

export async function deleteUserApi(username: string): Promise<void> {
  const res = await apiFetch(`/api/v1/admin/users/${username}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error('Failed to delete user');
}
