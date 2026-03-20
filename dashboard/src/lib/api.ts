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
