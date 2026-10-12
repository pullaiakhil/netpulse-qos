export type ProbeType = 'icmp' | 'tcp' | 'http';

export interface Target {
  id: string | number;
  name: string;
  host: string;
  type?: ProbeType;
  target_type?: ProbeType;
  port?: number | null;
  enabled: boolean;
  created_at?: string;
  updated_at?: string;
  last_tested?: string;
  last_status?: 'online' | 'offline' | 'degraded';
}

export interface MonitoringSession {
  id: string | number;
  target_id: string | number;
  target_name?: string;
  target_host?: string;
  start_time: string;
  end_time?: string | null;
  interval_seconds: number;
  status: 'running' | 'completed' | 'stopped';
  probes_count?: number;
}

export interface ProbeResult {
  id?: string | number;
  session_id: string | number;
  target_id?: string | number;
  timestamp: string;
  rtt_ms: number | null;
  jitter_ms: number | null;
  packet_loss_pct: number;
  success: boolean;
  error?: string | null;
  error_type?: string | null;
  error_detail?: string | null;
}

export interface LatencyStats {
  min_rtt_ms: number;
  max_rtt_ms: number;
  avg_rtt_ms: number;
  median_rtt_ms: number;
  p95_rtt_ms: number;
  p99_rtt_ms: number;
  jitter_ms: number;
  packet_loss_pct: number;
  total_probes: number;
  successful_probes: number;
}

export type QoSStatus = 'good' | 'degraded' | 'poor' | 'unknown' | 'insufficient_data';

export interface QoSSnapshot {
  session_id: string | number;
  timestamp: string;
  profile_name: string;
  status: QoSStatus;
  score: number; // 0 - 100
  latency_status: QoSStatus;
  jitter_status: QoSStatus;
  packet_loss_status: QoSStatus;
  avg_latency_ms: number;
  avg_jitter_ms: number;
  packet_loss_pct: number;
}

export interface QoSProfile {
  id: string;
  name: string;
  description: string;
  max_latency_ms: number;
  max_jitter_ms: number;
  max_packet_loss_pct: number;
  min_throughput_kbps?: number;
}

export interface StandardProfile extends QoSProfile {
  icon?: any;
}

export interface QoSMetricEvaluation {
  metric: string;
  value: number;
  threshold: number;
  unit: string;
  status: QoSStatus;
}

export interface QoSAssessment {
  profile: QoSProfile;
  overall_status: QoSStatus;
  overall_score: number;
  evaluations: QoSMetricEvaluation[];
  summary: string;
  timestamp: string;
}

export type AlertSeverity = 'info' | 'warning' | 'critical';

export interface Alert {
  id: string | number;
  target_id: string | number;
  target_name?: string;
  session_id?: string | number;
  timestamp: string;
  severity: AlertSeverity;
  metric: 'latency' | 'jitter' | 'packet_loss' | 'connectivity';
  threshold_value: number;
  actual_value?: number;
  observed_value?: number;
  unit?: string;
  message: string;
  acknowledged: boolean;
  resolved: boolean;
  resolved_at?: string | null;
}

export interface MonitoringStatus {
  active: boolean;
  current_session: MonitoringSession | null;
  active_target: Target | null;
  uptime_seconds?: number;
  probes_sent?: number;
}

export interface HealthResponse {
  status: string;
  timestamp: string;
  version: string;
  python_version: string;
  os: string;
  c_engine_status?: string;
  c_engine_binary?: string | null;
  memory_usage_mb?: number;
  cpu_percent?: number;
}

export interface TcpTestResult {
  host: string;
  port: number;
  success: boolean;
  rtt_ms?: number | null;
  connect_time_ms?: number | null;
  error?: string | null;
  error_type?: string | null;
  error_detail?: string | null;
  timestamp: string;
}

export interface IperfTestRequest {
  host: string;
  port?: number;
  duration_seconds?: number;
  authorized?: boolean;
}

export interface IperfTestResult {
  available: boolean;
  success: boolean;
  host: string;
  port: number;
  duration_seconds: number;
  rx_mbps?: number | null;
  tx_mbps?: number | null;
  retransmits?: number | null;
  error_type?: string | null;
  error_detail?: string | null;
  requirements_note: string;
  timestamp: string;
}

export interface NetworkInterface {
  name: string;
  description?: string;
  is_up: boolean;
  speed_mbps?: number;
  bytes_sent: number;
  bytes_recv: number;
  packets_sent: number;
  packets_recv: number;
  errin?: number;
  errout?: number;
  dropin?: number;
  dropout?: number;
}

export interface ThroughputReading {
  interface_name: string;
  timestamp: string;
  rx_kbps: number;
  tx_kbps: number;
  rx_mbps?: number;
  tx_mbps?: number;
  rx_total_bytes?: number;
  tx_total_bytes?: number;
}

export interface SessionReportSummary {
  session: MonitoringSession;
  stats: LatencyStats;
  qos_snapshot?: QoSSnapshot;
  probes: ProbeResult[];
  alerts_count: number;
}
