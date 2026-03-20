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

// Logs
export interface LogLineResponse {
  trace_id: string;
  service: string;
  message: string;
}

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

// Traces
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
