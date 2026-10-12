import React from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '@/components/layout/PageHeader';
import { MetricCard } from '@/components/ui/MetricCard';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { LatencyChart } from '@/components/charts/LatencyChart';
import { useMonitoring } from '@/hooks/useMonitoring';
import { useAlerts } from '@/hooks/useAlerts';
import { useHealth } from '@/hooks/useHealth';
import { useInterfaces } from '@/hooks/useInterfaces';
import {
  Activity,
  Clock,
  Zap,
  ShieldAlert,
  ArrowUpDown,
  AlertTriangle,
  Play,
  CheckCircle,
  ExternalLink,
  Radio,
} from 'lucide-react';
import { formatMs, formatPct, formatKbps, formatDateTime, formatNumber, formatSessionId } from '@/lib/utils';

export const Overview: React.FC = () => {
  const navigate = useNavigate();
  const { data: health, isError: isHealthError } = useHealth();
  const { isRunning, status, metrics, sessions, isLoadingStatus } = useMonitoring(4000);
  const { alerts } = useAlerts();
  const { throughputData } = useInterfaces();

  const isConnected = !!health && !isHealthError;
  const probes = metrics?.probes || [];
  const latestProbe = probes.length > 0 ? probes[probes.length - 1] : null;

  // Compute live averages or fallback to latest
  const avgLatency =
    probes.length > 0
      ? probes.filter((p) => p.rtt_ms !== null).reduce((acc, p) => acc + (p.rtt_ms || 0), 0) /
        (probes.filter((p) => p.rtt_ms !== null).length || 1)
      : latestProbe?.rtt_ms;

  const avgJitter =
    probes.length > 0
      ? probes.reduce((acc, p) => acc + (p.jitter_ms || 0), 0) / probes.length
      : latestProbe?.jitter_ms;

  const avgLoss =
    probes.length > 0
      ? ((probes.filter((p) => !p.success).length) / probes.length) * 100
      : (latestProbe ? (latestProbe.success ? 0 : 100) : undefined);

  // Throughput calculations
  const totalRx = throughputData.reduce((acc, curr) => acc + (curr.rx_kbps || 0), 0);
  const totalTx = throughputData.reduce((acc, curr) => acc + (curr.tx_kbps || 0), 0);

  const recentAlerts = alerts.slice(0, 5);
  const recentSessions = sessions.slice(0, 5);

  return (
    <div className="space-y-6">
      {/* Backend offline alert notice */}
      {!isConnected && (
        <div className="flex items-center justify-between p-4 bg-critical-bg border border-critical/30 rounded-lg text-sm text-critical-text">
          <div className="flex items-center gap-3">
            <ShieldAlert className="w-5 h-5 shrink-0" />
            <div>
              <p className="font-semibold">Backend Server Offline</p>
              <p className="text-xs opacity-90">
                Unable to connect to NetPulse backend. Ensure the server is listening on port 8000.
              </p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => window.location.reload()}>
            Reconnect
          </Button>
        </div>
      )}

      {/* Page Header */}
      <PageHeader
        title="Network QoS Overview"
        description="Comprehensive real-time network health, packet telemetry, and QoS metric tracking."
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate('/targets')}
            >
              Configure Targets
            </Button>
            <Button
              variant="primary"
              size="sm"
              icon={<Play className="w-3.5 h-3.5" />}
              onClick={() => navigate('/monitoring')}
            >
              {isRunning ? 'View Active Session' : 'Start Live Test'}
            </Button>
          </div>
        }
      />

      {/* Top Telemetry Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Latency (RTT)"
          value={avgLatency !== null && avgLatency !== undefined && !isNaN(avgLatency) ? formatNumber(avgLatency, 1) : '—'}
          unit="ms"
          subtitle={
            isRunning
              ? `Target: ${
                  status?.active_target?.name ||
                  (status as any)?.sessions?.[0]?.target_name ||
                  'Active'
                }`
              : 'Requires active probe'
          }
          status={
            avgLatency === undefined || avgLatency === null || isNaN(avgLatency)
              ? 'unknown'
              : avgLatency < 50
              ? 'good'
              : avgLatency < 120
              ? 'degraded'
              : 'poor'
          }
          icon={<Clock className="w-4 h-4 text-accent" />}
          loading={isLoadingStatus}
        />

        <MetricCard
          title="Packet Jitter"
          value={avgJitter !== null && avgJitter !== undefined && !isNaN(avgJitter) ? formatNumber(avgJitter, 2) : '—'}
          unit="ms"
          subtitle={isRunning ? 'Mean packet delay variation' : 'Requires active probe'}
          status={
            avgJitter === undefined || avgJitter === null || isNaN(avgJitter)
              ? 'unknown'
              : avgJitter < 20
              ? 'good'
              : avgJitter < 40
              ? 'degraded'
              : 'poor'
          }
          icon={<Activity className="w-4 h-4 text-warning" />}
          loading={isLoadingStatus}
        />

        <MetricCard
          title="Packet Loss"
          value={avgLoss !== null && avgLoss !== undefined && !isNaN(avgLoss) ? formatNumber(avgLoss, 1) : '—'}
          unit="%"
          subtitle={isRunning ? 'Ratio of lost transmission' : 'Requires active probe'}
          status={
            avgLoss === undefined || avgLoss === null || isNaN(avgLoss)
              ? 'unknown'
              : avgLoss === 0
              ? 'good'
              : avgLoss < 2.5
              ? 'degraded'
              : 'poor'
          }
          icon={<Zap className="w-4 h-4 text-critical" />}
          loading={isLoadingStatus}
        />

        <MetricCard
          title="Network Bandwidth"
          value={formatKbps(totalRx + totalTx)}
          unit=""
          subtitle={`Rx: ${formatKbps(totalRx)} · Tx: ${formatKbps(totalTx)}`}
          status="good"
          icon={<ArrowUpDown className="w-4 h-4 text-success" />}
          loading={isLoadingStatus}
        />
      </div>

      {/* Main Monitoring Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Chart Area (2 Cols) */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <div>
                <CardTitle>Real-Time Latency Telemetry</CardTitle>
                <CardDescription>
                  {isRunning
                    ? `Live probe feed for target "${status?.active_target?.name || 'Active'}" (${probes.length} probes)`
                    : 'Real-time Round Trip Time (RTT) stream'}
                </CardDescription>
              </div>
              {isRunning && (
                <div className="flex items-center gap-2">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-accent"></span>
                  </span>
                  <span className="text-xs font-medium text-accent">Sampling</span>
                </div>
              )}
            </CardHeader>

            {isRunning && probes.length > 0 ? (
              <div>
                <LatencyChart data={probes.slice(-50)} height={280} showDots={probes.length < 20} />
              </div>
            ) : (
              <EmptyState
                icon={<Radio className="w-6 h-6" />}
                title="No Monitoring Session Active"
                description="Start a live diagnostic probe to monitor latency, packet loss, and jitter in real-time."
                action={
                  <Button
                    size="sm"
                    variant="primary"
                    icon={<Play className="w-3.5 h-3.5" />}
                    onClick={() => navigate('/monitoring')}
                  >
                    Launch Live Session
                  </Button>
                }
              />
            )}
          </Card>

          {/* Recent Monitoring Sessions Table */}
          <Card>
            <CardHeader>
              <div>
                <CardTitle>Recent Monitoring Sessions</CardTitle>
                <CardDescription>Archive of recent diagnostic runs and telemetry sessions</CardDescription>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate('/reports')}
                icon={<ExternalLink className="w-3.5 h-3.5" />}
              >
                View History
              </Button>
            </CardHeader>

            {recentSessions.length === 0 ? (
              <EmptyState
                title="No sessions recorded yet"
                description="Completed and ongoing monitoring sessions will appear here."
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="text-xs text-text-muted bg-surface-secondary/50 border-b border-border">
                    <tr>
                      <th className="py-2.5 px-3 font-medium">Session ID</th>
                      <th className="py-2.5 px-3 font-medium">Target</th>
                      <th className="py-2.5 px-3 font-medium">Status</th>
                      <th className="py-2.5 px-3 font-medium">Started</th>
                      <th className="py-2.5 px-3 font-medium text-right">Interval</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {recentSessions.map((sess, idx) => (
                      <tr key={sess?.id ? String(sess.id) : `sess-${idx}`} className="hover:bg-surface-secondary/30 transition-colors">
                        <td className="py-2.5 px-3 font-mono text-xs text-text-secondary">
                          {formatSessionId(sess?.id)}
                        </td>
                        <td className="py-2.5 px-3 font-medium text-text-primary">
                          {sess.target_name || sess.target_host || 'Target'}
                        </td>
                        <td className="py-2.5 px-3">
                          <StatusBadge status={sess.status} size="sm" />
                        </td>
                        <td className="py-2.5 px-3 text-xs text-text-muted">
                          {formatDateTime(sess.start_time)}
                        </td>
                        <td className="py-2.5 px-3 text-xs text-right font-medium">
                          {sess.interval_seconds}s
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>

        {/* Sidebar / Alert Panel (1 Col) */}
        <div className="space-y-6">
          {/* Active Status Box */}
          <Card>
            <CardHeader>
              <div>
                <CardTitle>Session Status</CardTitle>
                <CardDescription>Current telemetry probe status</CardDescription>
              </div>
              <StatusBadge status={isRunning ? 'running' : 'stopped'} />
            </CardHeader>

            <div className="space-y-3 text-xs">
              <div className="flex justify-between py-1.5 border-b border-border/50">
                <span className="text-text-secondary">Active Target:</span>
                <span className="font-medium text-text-primary">
                  {status?.active_target?.name || 'None'}
                </span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-border/50">
                <span className="text-text-secondary">Protocol:</span>
                <span className="font-medium uppercase text-text-primary">
                  {status?.active_target?.type || '—'}
                </span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-border/50">
                <span className="text-text-secondary">Probes Dispatched:</span>
                <span className="font-mono font-medium text-text-primary">
                  {probes.length}
                </span>
              </div>
              <div className="flex justify-between py-1.5">
                <span className="text-text-secondary">Sampling Rate:</span>
                <span className="font-medium text-text-primary">
                  {status?.current_session?.interval_seconds ? `${status.current_session.interval_seconds}s` : '—'}
                </span>
              </div>

              <div className="pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() => navigate('/monitoring')}
                >
                  Manage Live Session
                </Button>
              </div>
            </div>
          </Card>

          {/* Recent Alerts Box */}
          <Card>
            <CardHeader>
              <div>
                <CardTitle>Recent Alerts</CardTitle>
                <CardDescription>Network threshold anomalies</CardDescription>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate('/alerts')}
                icon={<ExternalLink className="w-3.5 h-3.5" />}
              >
                All
              </Button>
            </CardHeader>

            {recentAlerts.length === 0 ? (
              <div className="py-6 text-center">
                <CheckCircle className="w-8 h-8 text-success mx-auto mb-2 opacity-80" />
                <p className="text-xs font-medium text-text-primary">No Active Alerts</p>
                <p className="text-[11px] text-text-muted mt-0.5">
                  Network metrics are within QoS boundaries.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {recentAlerts.map((alt) => (
                  <div
                    key={String(alt.id)}
                    className="p-3 rounded-md border border-border bg-surface-secondary/40 text-xs space-y-1"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-text-primary capitalize flex items-center gap-1.5">
                        <AlertTriangle className={`w-3.5 h-3.5 ${alt.severity === 'critical' ? 'text-critical' : 'text-warning'}`} />
                        {alt.metric} Threshold Exceeded
                      </span>
                      <span className="text-[10px] text-text-muted">{formatDateTime(alt.timestamp)}</span>
                    </div>
                    <p className="text-text-secondary text-[11px]">{alt.message}</p>
                    <div className="text-[11px] font-mono text-text-muted pt-0.5">
                      Actual: {alt.actual_value}{alt.unit} (Limit: {alt.threshold_value}{alt.unit})
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
};
