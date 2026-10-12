import {
  Alert,
  HealthResponse,
  MonitoringSession,
  MonitoringStatus,
  NetworkInterface,
  ProbeResult,
  SessionReportSummary,
  Target,
  ProbeType,
  TcpTestResult,
  ThroughputReading,
} from './types';

// Configurable backend API base URL via Vite environment variable
const RAW_API_BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim();
export const API_BASE = (() => {
  if (!RAW_API_BASE) return '/api';
  const stripped = RAW_API_BASE.replace(/\/+$/, '');
  return stripped.endsWith('/api') ? stripped : `${stripped}/api`;
})();

async function fetchApi<T>(path: string, options?: RequestInit): Promise<T> {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  const res = await fetch(`${API_BASE}${cleanPath}`, {
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    ...options,
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(error.detail || res.statusText || 'API request failed');
  }
  return res.json();
}

export const api = {
  health: (): Promise<HealthResponse> => fetchApi('/health'),
  
  getTargets: async (): Promise<Target[]> => {
    const list = await fetchApi<any[]>('/targets');
    return (list || []).map((t) => ({
      ...t,
      id: String(t.id),
      type: (t.target_type || t.type || 'icmp') as ProbeType,
      target_type: (t.target_type || t.type || 'icmp') as ProbeType,
    }));
  },
  createTarget: async (data: Omit<Target, 'id'>): Promise<Target> => {
    const payload = {
      ...data,
      target_type: data.target_type || data.type || 'icmp',
    };
    const res = await fetchApi<any>('/targets', { method: 'POST', body: JSON.stringify(payload) });
    return {
      ...res,
      id: String(res.id),
      type: (res.target_type || res.type || 'icmp') as ProbeType,
      target_type: (res.target_type || res.type || 'icmp') as ProbeType,
    };
  },
  updateTarget: (id: string, data: Partial<Target>): Promise<Target> =>
    fetchApi(`/targets/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({
        ...data,
        ...(data.type ? { target_type: data.type } : {}),
      }),
    }),
  deleteTarget: (id: string): Promise<{ success: boolean }> =>
    fetchApi(`/targets/${id}`, { method: 'DELETE' }),

  startMonitoring: (data: { target_id: string | number; interval_seconds?: number }): Promise<MonitoringSession> =>
    fetchApi('/monitoring/start', { method: 'POST', body: JSON.stringify(data) }),
  stopMonitoring: (data?: { session_id?: string | number }): Promise<{ success: boolean; session?: MonitoringSession }> =>
    fetchApi('/monitoring/stop', { method: 'POST', body: JSON.stringify(data || {}) }),
  getMonitoringStatus: (): Promise<MonitoringStatus> => fetchApi('/monitoring/status'),
  
  getMetrics: (sessionId?: string | number): Promise<{ session: MonitoringSession; probes: ProbeResult[] }> =>
    fetchApi(`/monitoring/metrics${sessionId ? `?session_id=${sessionId}` : ''}`),
  
  getHistory: (params: Record<string, string | number>): Promise<ProbeResult[]> => {
    const cleanParams: Record<string, string> = {};
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== null) cleanParams[k] = String(v);
    }
    return fetchApi(`/monitoring/history?${new URLSearchParams(cleanParams).toString()}`);
  },
  
  getSessions: (): Promise<MonitoringSession[]> => fetchApi('/monitoring/sessions'),
  
  runTcpTest: (data: { host: string; port: number }): Promise<TcpTestResult> =>
    fetchApi('/tests/tcp', { method: 'POST', body: JSON.stringify(data) }),
  runPingTest: (data: { host: string; count?: number }): Promise<any> =>
    fetchApi('/tests/ping', { method: 'POST', body: JSON.stringify(data) }),
  runMultiTargetCompare: (data: {
    targets: Array<{ name: string; host: string; protocol: string; port?: number | null }>;
    probes_per_target?: number;
    timeout_seconds?: number;
  }): Promise<{
    timestamp: string;
    results: Array<{
      name: string;
      host: string;
      protocol: string;
      port?: number | null;
      resolved_ip?: string | null;
      probes_sent: number;
      probes_received: number;
      packet_loss_pct: number;
      min_rtt_ms?: number | null;
      max_rtt_ms?: number | null;
      mean_rtt_ms?: number | null;
      jitter_ms?: number | null;
      status: string;
      diagnostic?: string | null;
      probes: any[];
    }>;
  }> => fetchApi('/tests/compare', { method: 'POST', body: JSON.stringify(data) }),
  
  getAlerts: (params?: Record<string, string>): Promise<Alert[]> => {
    const query = params && Object.keys(params).length > 0 ? `?${new URLSearchParams(params).toString()}` : '';
    return fetchApi(`/alerts${query}`);
  },
  acknowledgeAlert: (alertId: string | number): Promise<Alert> =>
    fetchApi(`/alerts/${alertId}/acknowledge`, { method: 'PUT' }),
  resolveAlert: (alertId: string | number): Promise<Alert> =>
    fetchApi(`/alerts/${alertId}/resolve`, { method: 'PUT' }),

  runIperfTest: (data: {
    host: string;
    port?: number;
    duration_seconds?: number;
    authorized?: boolean;
  }): Promise<any> => fetchApi('/tests/iperf', { method: 'POST', body: JSON.stringify(data) }),

  exportCsv: (sessionId: string | number) => `${API_BASE}/reports/export?session_id=${sessionId}&format=csv`,
  
  getInterfaces: (): Promise<{ interfaces: NetworkInterface[]; throughput?: ThroughputReading[] }> =>
    fetchApi('/interfaces'),
  getThroughputHistory: (): Promise<ThroughputReading[]> =>
    fetchApi('/interfaces/throughput'),
  
  getReportSummary: (sessionId: string | number): Promise<SessionReportSummary> =>
    fetchApi(`/reports/summary?session_id=${sessionId}`),
};
