import React, { useState } from 'react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { EmptyState } from '@/components/ui/EmptyState';
import { LatencyChart } from '@/components/charts/LatencyChart';
import { JitterChart } from '@/components/charts/JitterChart';
import { PacketLossChart } from '@/components/charts/PacketLossChart';
import { useMonitoring } from '@/hooks/useMonitoring';
import { useTargets } from '@/hooks/useTargets';
import { api } from '@/lib/api';
import {
  Play,
  Square,
  Activity,
  Radio,
  Clock,
  Layers,
  CheckCircle2,
  AlertTriangle,
  BarChart2,
  RefreshCw,
  Globe,
  Sliders,
  Info,
} from 'lucide-react';
import { formatMs, formatPct, formatDateTime, formatDuration, getTargetProtocol } from '@/lib/utils';

export const LiveMonitoring: React.FC = () => {
  const { data: targets = [], isLoading: isLoadingTargets } = useTargets();
  const {
    isRunning,
    status,
    metrics,
    startMonitoring,
    stopMonitoring,
    isStarting,
    isStopping,
  } = useMonitoring(1500);

  const [activeTab, setActiveTab] = useState<'live' | 'compare'>('live');
  const [selectedTargetId, setSelectedTargetId] = useState<string>('');
  const [selectedInterval, setSelectedInterval] = useState<number>(1);
  const [errorNotice, setErrorNotice] = useState<string | null>(null);

  // Multi-target lab comparison state
  const [isComparing, setIsComparing] = useState<boolean>(false);
  const [compareResults, setCompareResults] = useState<any[]>([]);
  const [compareTimestamp, setCompareTimestamp] = useState<string | null>(null);

  // Set default selected target once loaded, prioritizing Google DNS (8.8.8.8)
  React.useEffect(() => {
    if (targets.length > 0 && !selectedTargetId) {
      const googleDns = targets.find((t) => t.host === '8.8.8.8');
      setSelectedTargetId(String(googleDns ? googleDns.id : targets[0].id));
    }
  }, [targets, selectedTargetId]);

  const activeSessionInfo = (status as any)?.sessions?.[0];
  const activeTarget = isRunning
    ? status?.active_target
      ? {
          ...status.active_target,
          type: (status.active_target.target_type || status.active_target.type || 'icmp') as any,
        }
      : activeSessionInfo
      ? {
          id: String(activeSessionInfo.target_id),
          name: activeSessionInfo.target_name || 'Active Session Target',
          host: activeSessionInfo.target_host || 'Unknown Host',
          type: (activeSessionInfo.target_type || 'icmp') as any,
          enabled: true,
        }
      : targets.find((t) => String(t.id) === String(selectedTargetId))
    : targets.find((t) => String(t.id) === String(selectedTargetId));

  const probes = metrics?.probes || [];
  const latestProbe = probes.length > 0 ? probes[probes.length - 1] : null;

  // Real-time statistical aggregates across actual received probes
  const validRtts = probes
    .filter((p) => p.success && p.rtt_ms !== null && p.rtt_ms !== undefined)
    .map((p) => p.rtt_ms as number);
  const minRtt = validRtts.length > 0 ? Math.min(...validRtts) : null;
  const maxRtt = validRtts.length > 0 ? Math.max(...validRtts) : null;
  const avgRtt = validRtts.length > 0 ? validRtts.reduce((a, b) => a + b, 0) / validRtts.length : null;

  // Calculate live jitter as mean absolute difference between consecutive valid RTT samples
  let liveJitter: number | null = null;
  if (validRtts.length >= 2) {
    let diffSum = 0;
    for (let i = 1; i < validRtts.length; i++) {
      diffSum += Math.abs(validRtts[i] - validRtts[i - 1]);
    }
    liveJitter = diffSum / (validRtts.length - 1);
  }

  const successCount = validRtts.length;
  const failedCount = probes.length - successCount;
  const lossPct = probes.length > 0 ? (failedCount / probes.length) * 100 : null;

  const [sessionDurationLimit, setSessionDurationLimit] = useState<number>(60);
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);

  // Auto-stop session countdown
  React.useEffect(() => {
    let timer: any;
    if (isRunning) {
      setElapsedSeconds(0);
      timer = setInterval(() => {
        setElapsedSeconds((prev) => {
          const next = prev + 1;
          if (sessionDurationLimit > 0 && next >= sessionDurationLimit) {
            handleStop();
          }
          return next;
        });
      }, 1000);
    } else {
      setElapsedSeconds(0);
    }
    return () => clearInterval(timer);
  }, [isRunning, sessionDurationLimit]);

  const handleStart = async () => {
    setErrorNotice(null);
    if (!selectedTargetId) {
      setErrorNotice('Please select a target first.');
      return;
    }
    try {
      await startMonitoring({
        target_id: selectedTargetId,
        interval_seconds: selectedInterval,
      });
    } catch (err: any) {
      setErrorNotice(err.message || 'Failed to start monitoring session');
    }
  };

  const handleStop = async () => {
    setErrorNotice(null);
    try {
      const activeSid =
        status?.current_session?.id ||
        (status as any)?.sessions?.[0]?.session_id?.toString();
      await stopMonitoring({ session_id: activeSid });
    } catch (err: any) {
      setErrorNotice(err.message || 'Failed to stop monitoring session');
    }
  };

  const handleRunComparison = async () => {
    setErrorNotice(null);
    setIsComparing(true);
    try {
      // Benchmark Google DNS (8.8.8.8 ICMP), Cloudflare DNS (1.1.1.1 ICMP), and Local Backend (127.0.0.1:8000 TCP)
      const benchmarkTargets = [
        { name: 'Google DNS', host: '8.8.8.8', protocol: 'icmp' },
        { name: 'Cloudflare DNS', host: '1.1.1.1', protocol: 'icmp' },
        { name: 'Localhost Backend (TCP)', host: '127.0.0.1', protocol: 'tcp', port: 8000 },
      ];

      // Include authorized user configured targets if present
      for (const t of targets) {
        if (!benchmarkTargets.some((b) => b.host === t.host && (b.protocol === (t.target_type || t.type)))) {
          benchmarkTargets.push({
            name: t.name || t.host,
            host: t.host,
            protocol: (t.target_type || t.type || 'icmp').toLowerCase(),
            port: t.port || (t.target_type === 'tcp' ? 80 : undefined),
          });
          if (benchmarkTargets.length >= 5) break;
        }
      }

      const res = await api.runMultiTargetCompare({
        targets: benchmarkTargets,
        probes_per_target: 3,
        timeout_seconds: 2.0,
      });

      setCompareResults(res.results || []);
      setCompareTimestamp(res.timestamp);
    } catch (err: any) {
      setErrorNotice(err.message || 'Failed to execute multi-target comparison benchmark');
    } finally {
      setIsComparing(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Live QoS Telemetry"
        description="Continuously ping and diagnose round-trip times, delay jitter, and loss rates."
        badge={<StatusBadge status={isRunning ? 'running' : 'stopped'} />}
        actions={
          <div className="flex items-center gap-1.5 bg-surface-secondary p-1 rounded-lg border border-border">
            <button
              onClick={() => setActiveTab('live')}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all flex items-center gap-1.5 ${
                activeTab === 'live'
                  ? 'bg-white text-text-primary shadow-xs font-bold'
                  : 'text-text-muted hover:text-text-primary'
              }`}
            >
              <Activity className="w-3.5 h-3.5" />
              <span>Live Monitor</span>
            </button>
            <button
              onClick={() => setActiveTab('compare')}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all flex items-center gap-1.5 ${
                activeTab === 'compare'
                  ? 'bg-white text-accent shadow-xs font-bold'
                  : 'text-text-muted hover:text-text-primary'
              }`}
            >
              <Globe className="w-3.5 h-3.5" />
              <span>Multi-Target Lab</span>
            </button>
          </div>
        }
      />

      {/* Cloud & Remote Measurement Notice */}
      <div className="px-3.5 py-2 rounded-lg bg-surface-secondary/70 border border-border text-xs text-text-secondary flex items-center gap-2">
        <Info className="w-4 h-4 text-accent shrink-0" />
        <span>
          <strong>Telemetry Origin Notice:</strong> Probes originate from the NetPulse engine on the host system to destination endpoints. In cloud-hosted deployments, this measures connectivity from the hosting server, not the visitor's browser.
        </span>
      </div>

      {errorNotice && (
        <div className="p-3 rounded-md bg-critical-bg border border-critical/30 text-critical-text text-sm flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{errorNotice}</span>
        </div>
      )}

      {/* ============================================================ */}
      {/* SCENARIO 1: MULTI-TARGET COMPARISON LAB                      */}
      {/* ============================================================ */}
      {activeTab === 'compare' && (
        <div className="space-y-6">
          <Card>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  <Globe className="w-4 h-4 text-accent" />
                  Multi-Target Side-by-Side Network Benchmark
                </CardTitle>
                <CardDescription>
                  Probe Google Public DNS (8.8.8.8), Cloudflare DNS (1.1.1.1), and authorized TCP services simultaneously with genuine socket packets.
                </CardDescription>
              </div>
              <Button
                variant="primary"
                size="md"
                onClick={handleRunComparison}
                disabled={isComparing}
                icon={<RefreshCw className={`w-4 h-4 ${isComparing ? 'animate-spin' : ''}`} />}
              >
                {isComparing ? 'Testing Endpoints...' : 'Run Lab Benchmark'}
              </Button>
            </div>

            {compareResults.length === 0 ? (
              <div className="py-12">
                <EmptyState
                  icon={<Globe className="w-8 h-8 text-accent" />}
                  title="Multi-Target Benchmark Ready"
                  description="Click 'Run Lab Benchmark' above to execute simultaneous diagnostic probes across Google DNS (8.8.8.8), Cloudflare (1.1.1.1), and Localhost TCP service."
                  action={
                    <Button variant="primary" size="sm" onClick={handleRunComparison} disabled={isComparing}>
                      Execute Initial Benchmark
                    </Button>
                  }
                />
              </div>
            ) : (
              <div className="mt-4 space-y-4">
                <div className="text-xs text-text-muted flex items-center justify-between">
                  <span>Last benchmarked: {compareTimestamp ? new Date(compareTimestamp).toLocaleTimeString() : 'Just now'}</span>
                  <span className="text-[11px] font-mono text-text-secondary">3 genuine probes per target (monotonic clock)</span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-surface-secondary/70 text-xs font-semibold text-text-muted border-y border-border">
                      <tr>
                        <th className="py-2.5 px-3">Target Name</th>
                        <th className="py-2.5 px-3">Host / Port</th>
                        <th className="py-2.5 px-3">Protocol</th>
                        <th className="py-2.5 px-3">Status</th>
                        <th className="py-2.5 px-3 text-right">Mean Latency</th>
                        <th className="py-2.5 px-3 text-right">Min / Max</th>
                        <th className="py-2.5 px-3 text-right">Jitter</th>
                        <th className="py-2.5 px-3 text-right">Loss Rate</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {compareResults.map((r, i) => (
                        <tr key={i} className="hover:bg-surface-secondary/20 transition-colors">
                          <td className="py-3 px-3 font-semibold text-text-primary">
                            {r.name}
                          </td>
                          <td className="py-3 px-3 font-mono text-xs text-text-secondary">
                            {r.host} {r.port ? `:${r.port}` : ''}
                            {r.resolved_ip && r.resolved_ip !== r.host && (
                              <span className="text-[10px] text-text-muted block">({r.resolved_ip})</span>
                            )}
                          </td>
                          <td className="py-3 px-3">
                            <span className="text-[11px] font-mono font-bold px-1.5 py-0.5 rounded bg-surface-secondary border border-border text-text-secondary">
                              {r.protocol}
                            </span>
                          </td>
                          <td className="py-3 px-3">
                            {r.status === 'online' ? (
                              <span className="inline-flex items-center gap-1 text-xs font-semibold text-success">
                                <CheckCircle2 className="w-3.5 h-3.5" /> Online
                              </span>
                            ) : r.status === 'degraded' ? (
                              <span className="inline-flex items-center gap-1 text-xs font-semibold text-warning">
                                <AlertTriangle className="w-3.5 h-3.5" /> Degraded
                              </span>
                            ) : r.status === 'icmp_blocked' ? (
                              <span className="inline-flex items-center gap-1 text-xs font-semibold text-warning" title={r.diagnostic || 'ICMP Restricted'}>
                                <AlertTriangle className="w-3.5 h-3.5" /> ICMP Restricted
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-xs font-semibold text-critical" title={r.diagnostic || 'Unreachable'}>
                                <AlertTriangle className="w-3.5 h-3.5" /> {r.diagnostic || 'Unreachable'}
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-3 text-right font-mono font-semibold text-text-primary">
                            {r.mean_rtt_ms !== null && r.mean_rtt_ms !== undefined ? formatMs(r.mean_rtt_ms) : '—'}
                          </td>
                          <td className="py-3 px-3 text-right text-xs font-mono text-text-muted">
                            {r.min_rtt_ms !== null && r.max_rtt_ms !== null
                              ? `${formatMs(r.min_rtt_ms)} / ${formatMs(r.max_rtt_ms)}`
                              : '—'}
                          </td>
                          <td className="py-3 px-3 text-right font-mono text-xs text-text-secondary">
                            {r.jitter_ms !== null && r.jitter_ms !== undefined ? formatMs(r.jitter_ms) : '—'}
                          </td>
                          <td className="py-3 px-3 text-right font-mono">
                            <span className={`text-xs font-semibold ${r.packet_loss_pct > 0 ? 'text-critical' : 'text-success'}`}>
                              {formatPct(r.packet_loss_pct)}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </Card>
        </div>
      )}

      {/* ============================================================ */}
      {/* SCENARIO 1 & 2: LIVE TELEMETRY CONTINUOUS MONITORING         */}
      {/* ============================================================ */}
      {activeTab === 'live' && (
        <>

      {/* Control Bar */}
      <Card>
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-4 w-full md:w-auto">
            <div className="min-w-[220px]">
              <Select
                label="Monitoring Target"
                disabled={isRunning || isLoadingTargets || targets.length === 0}
                value={
                  isRunning
                    ? String(status?.active_target?.id ?? activeSessionInfo?.target_id ?? selectedTargetId)
                    : String(selectedTargetId || '')
                }
                onChange={(e) => setSelectedTargetId(e.target.value)}
              >
                {isLoadingTargets ? (
                  <option value="">Loading targets...</option>
                ) : targets.length === 0 ? (
                  <option value="">No targets configured</option>
                ) : (
                  targets.map((t) => {
                    const protocol = getTargetProtocol(t);
                    return (
                      <option key={t.id} value={t.id}>
                        {t.name || 'Unnamed Target'} ({t.host || 'unknown'} - {protocol})
                      </option>
                    );
                  })
                )}
              </Select>
            </div>

            <div className="w-[140px]">
              <Select
                label="Sampling Interval"
                disabled={isRunning}
                value={selectedInterval}
                onChange={(e) => setSelectedInterval(Number(e.target.value))}
                options={[
                  { value: 1, label: '1 second' },
                  { value: 2, label: '2 seconds' },
                  { value: 3, label: '3 seconds' },
                  { value: 5, label: '5 seconds' },
                  { value: 10, label: '10 seconds' },
                ]}
              />
            </div>

            <div className="w-[140px]">
              <Select
                label="Duration Limit"
                disabled={isRunning}
                value={sessionDurationLimit}
                onChange={(e) => setSessionDurationLimit(Number(e.target.value))}
                options={[
                  { value: 30, label: '30 seconds' },
                  { value: 60, label: '60 seconds' },
                  { value: 120, label: '2 minutes' },
                  { value: 0, label: 'Unlimited' },
                ]}
              />
            </div>
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto justify-end">
            {isRunning && sessionDurationLimit > 0 && (
              <div className="text-xs font-mono px-3 py-1.5 bg-surface-secondary rounded-md text-text-secondary border border-border flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-accent animate-pulse" />
                <span>Elapsed: {elapsedSeconds}s / {sessionDurationLimit}s</span>
              </div>
            )}

            {isRunning ? (
              <Button
                variant="danger"
                size="md"
                icon={<Square className="w-4 h-4" />}
                loading={isStopping}
                onClick={handleStop}
              >
                Stop Live Session
              </Button>
            ) : (
              <Button
                variant="primary"
                size="md"
                icon={<Play className="w-4 h-4" />}
                loading={isStarting}
                disabled={targets.length === 0}
                onClick={handleStart}
              >
                Start Live Monitoring
              </Button>
            )}
          </div>
        </div>
      </Card>

      {/* Monitoring Content */}
      {isRunning ? (
        <div className="space-y-6">
          {/* Real-time Status Card & Latest Probe stats */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="flex flex-col justify-between">
              <span className="text-xs font-semibold text-text-muted uppercase">Target Endpoint</span>
              <div className="my-2">
                <p className="text-base font-bold text-text-primary truncate">
                  {activeTarget?.name || 'Target'}
                </p>
                <p className="text-xs font-mono text-text-secondary mt-0.5">
                  {activeTarget?.host || '—'} ({getTargetProtocol(activeTarget)})
                </p>
              </div>
              <div className="text-[11px] text-text-muted pt-2 border-t border-border flex items-center justify-between">
                <span>Success: <strong className="text-success">{successCount}</strong></span>
                <span>Failed: <strong className={failedCount > 0 ? "text-critical" : "text-text-muted"}>{failedCount}</strong></span>
              </div>
            </Card>

            <Card className="flex flex-col justify-between">
              <span className="text-xs font-semibold text-text-muted uppercase">
                {getTargetProtocol(activeTarget) === 'TCP' ? 'TCP Handshake Delay' : 'Current & Average RTT'}
              </span>
              <div className="my-2">
                <span className="text-2xl font-bold tabular-nums text-text-primary">
                  {latestProbe?.rtt_ms !== null && latestProbe?.rtt_ms !== undefined
                    ? formatMs(latestProbe.rtt_ms)
                    : '—'}
                </span>
                <span className="text-xs text-text-muted ml-2">
                  (Avg: {avgRtt !== null ? formatMs(avgRtt) : '—'})
                </span>
              </div>
              <div className="text-[11px] text-text-muted pt-2 border-t border-border flex items-center justify-between">
                <span>Min: {minRtt !== null ? formatMs(minRtt) : '—'}</span>
                <span>Max: {maxRtt !== null ? formatMs(maxRtt) : '—'}</span>
              </div>
            </Card>

            <Card className="flex flex-col justify-between">
              <span className="text-xs font-semibold text-text-muted uppercase">Delay Jitter</span>
              <div className="my-2">
                <span className="text-2xl font-bold tabular-nums text-text-primary">
                  {liveJitter !== null ? formatMs(liveJitter) : '—'}
                </span>
              </div>
              <div className="text-[11px] text-text-muted pt-2 border-t border-border truncate" title={latestProbe?.error_detail || ''}>
                {latestProbe?.success ? (
                  <span className="text-success flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" />
                    {getTargetProtocol(activeTarget) === 'TCP' ? 'TCP handshake successful' : 'ICMP echo reply received'}
                  </span>
                ) : (
                  <span className="text-critical flex items-center gap-1 truncate">
                    <AlertTriangle className="w-3 h-3 shrink-0" />
                    <span className="truncate">{latestProbe?.error_detail || latestProbe?.error_type || 'Probe failed'}</span>
                  </span>
                )}
              </div>
            </Card>

            <Card className="flex flex-col justify-between">
              <span className="text-xs font-semibold text-text-muted uppercase">Dispatched Samples</span>
              <div className="my-2 flex items-baseline justify-between">
                <div>
                  <span className="text-2xl font-bold tabular-nums text-text-primary">
                    {probes.length}
                  </span>
                  <span className="text-xs text-text-secondary ml-1">samples</span>
                </div>
                <div className="text-right">
                  <span className="text-xs text-text-muted block">Loss Rate</span>
                  <span className={`text-sm font-bold ${lossPct && lossPct > 0 ? "text-critical" : "text-success"}`}>
                    {lossPct !== null ? formatPct(lossPct) : '0.0%'}
                  </span>
                </div>
              </div>
              <div className="text-[11px] text-text-muted pt-2 border-t border-border flex items-center justify-between">
                <span>Latest Probe:</span>
                <span className="font-mono text-text-secondary">
                  {latestProbe?.timestamp ? new Date(latestProbe.timestamp).toLocaleTimeString() : '—'}
                </span>
              </div>
            </Card>
          </div>

          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <div>
                  <CardTitle>
                    {getTargetProtocol(activeTarget) === 'TCP' ? 'TCP Handshake Delay (ms)' : 'Latency Telemetry (ms)'}
                  </CardTitle>
                  <CardDescription>
                    {getTargetProtocol(activeTarget) === 'TCP'
                      ? 'Live socket connection establishment latency stream'
                      : 'Live real-time round-trip latency stream'}
                  </CardDescription>
                </div>
              </CardHeader>
              <LatencyChart data={probes} height={260} showDots={probes.length < 30} />
            </Card>

            <Card>
              <CardHeader>
                <div>
                  <CardTitle>Jitter Trend (ms)</CardTitle>
                  <CardDescription>Statistical variation in packet arrival delay</CardDescription>
                </div>
              </CardHeader>
              <JitterChart data={probes} height={260} showDots={probes.length < 30} />
            </Card>
          </div>

          {/* Loss Chart */}
          <Card>
            <CardHeader>
              <div>
                <CardTitle>Packet Loss Ratio (%)</CardTitle>
                <CardDescription>Loss percentage evaluated per sample window</CardDescription>
              </div>
            </CardHeader>
            <PacketLossChart data={probes} height={200} />
          </Card>
        </div>
      ) : (
        <Card className="py-12">
          <EmptyState
            icon={<Radio className="w-8 h-8 text-accent" />}
            title="Live Monitoring Inactive"
            description="Select a configured destination endpoint from the selector above and click 'Start Live Monitoring' to begin streaming probe packets."
            action={
              targets.length === 0 ? (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => (window.location.href = '/targets')}
                >
                  Create Target First
                </Button>
              ) : undefined
            }
          />
        </Card>
      )}
        </>
      )}
    </div>
  );
};
