import React, { useState } from 'react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { MetricCard } from '@/components/ui/MetricCard';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { EmptyState } from '@/components/ui/EmptyState';
import { Select } from '@/components/ui/Select';
import { LatencyChart } from '@/components/charts/LatencyChart';
import { useMonitoring } from '@/hooks/useMonitoring';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import {
  Download,
  Calendar,
  FileSpreadsheet,
  Clock,
  Layers,
  ChevronRight,
  BarChart3,
  GitCompare,
  TrendingUp,
  TrendingDown,
  Minus,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import {
  formatMs,
  formatPct,
  formatDateTime,
  formatDuration,
  formatNumber,
  formatSessionId,
} from '@/lib/utils';

export const Reports: React.FC = () => {
  const { sessions, isLoadingSessions } = useMonitoring();
  const [activeTab, setActiveTab] = useState<'single' | 'compare'>('single');
  const [selectedSessionId, setSelectedSessionId] = useState<string | number | null>(null);

  // Comparison mode states
  const [sessionAId, setSessionAId] = useState<string | number>('');
  const [sessionBId, setSessionBId] = useState<string | number>('');

  // Default selection for single view
  React.useEffect(() => {
    if (sessions.length > 0 && !selectedSessionId) {
      setSelectedSessionId(sessions[0].id);
    }
  }, [sessions, selectedSessionId]);

  // Default selection for comparison view
  React.useEffect(() => {
    if (sessions.length >= 2) {
      if (!sessionAId) setSessionAId(sessions[1].id);
      if (!sessionBId) setSessionBId(sessions[0].id);
    } else if (sessions.length === 1) {
      if (!sessionAId) setSessionAId(sessions[0].id);
      if (!sessionBId) setSessionBId(sessions[0].id);
    }
  }, [sessions, sessionAId, sessionBId]);

  const activeSessionId =
    selectedSessionId !== null && selectedSessionId !== undefined
      ? selectedSessionId
      : (sessions[0]?.id ?? '');

  // Single Session Data
  const { data: summaryData, isLoading: isLoadingSummary } = useQuery({
    queryKey: ['report-summary', activeSessionId],
    queryFn: () => api.getReportSummary(activeSessionId),
    enabled: !!activeSessionId,
  });

  const { data: historyData } = useQuery({
    queryKey: ['report-history', activeSessionId],
    queryFn: () => api.getHistory({ session_id: activeSessionId, limit: 100 }),
    enabled: !!activeSessionId,
  });

  // Comparison Sessions Data
  const { data: summaryA, isLoading: isLoadingA } = useQuery({
    queryKey: ['report-summary', sessionAId],
    queryFn: () => api.getReportSummary(sessionAId),
    enabled: !!sessionAId && activeTab === 'compare',
  });

  const { data: summaryB, isLoading: isLoadingB } = useQuery({
    queryKey: ['report-summary', sessionBId],
    queryFn: () => api.getReportSummary(sessionBId),
    enabled: !!sessionBId && activeTab === 'compare',
  });

  const selectedSession = sessions.find((s) => s.id === activeSessionId);
  const sessionA = sessions.find((s) => s.id === sessionAId);
  const sessionB = sessions.find((s) => s.id === sessionBId);

  const probes = historyData || [];
  const stats = summaryData as any;
  const statsA = summaryA as any;
  const statsB = summaryB as any;

  // Comparison Calculations
  const latA = statsA?.mean_rtt_ms ?? statsA?.avg_rtt_ms ?? null;
  const latB = statsB?.mean_rtt_ms ?? statsB?.avg_rtt_ms ?? null;
  const deltaLat = latA !== null && latB !== null ? latB - latA : null;
  const pctChangeLat = latA !== null && latB !== null && latA > 0 ? ((latB - latA) / latA) * 100 : null;

  const lossA = statsA?.packet_loss_pct ?? null;
  const lossB = statsB?.packet_loss_pct ?? null;
  const deltaLoss = lossA !== null && lossB !== null ? lossB - lossA : null;

  const jitA = statsA?.jitter_ms ?? null;
  const jitB = statsB?.jitter_ms ?? null;
  const deltaJit = jitA !== null && jitB !== null ? jitB - jitA : null;

  const handleExportCsv = () => {
    if (!activeSessionId) return;
    const downloadUrl = api.exportCsv(activeSessionId);
    window.open(downloadUrl, '_blank');
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Session Reports & Historical Audit"
        description="Audit telemetry archives, compare SLA performance across sessions, and export CSV logs."
        actions={
          <div className="flex items-center gap-3">
            <div className="inline-flex rounded-lg border border-border bg-surface-secondary/40 p-0.5">
              <button
                type="button"
                onClick={() => setActiveTab('single')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                  activeTab === 'single'
                    ? 'bg-white text-accent shadow-sm'
                    : 'text-text-secondary hover:text-text-primary'
                }`}
              >
                Single Session Audit
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('compare')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                  activeTab === 'compare'
                    ? 'bg-white text-accent shadow-sm'
                    : 'text-text-secondary hover:text-text-primary'
                }`}
              >
                Historical Comparison
              </button>
            </div>

            {activeTab === 'single' && (
              <Button
                variant="primary"
                size="md"
                icon={<Download className="w-4 h-4" />}
                disabled={!activeSessionId}
                onClick={handleExportCsv}
              >
                Export CSV Log
              </Button>
            )}
          </div>
        }
      />

      {/* ============================================================ */}
      {/* SINGLE SESSION AUDIT VIEW                                    */}
      {/* ============================================================ */}
      {activeTab === 'single' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column: Sessions List */}
          <div className="space-y-4">
            <Card noPadding>
              <div className="p-4 border-b border-border">
                <CardTitle>Recorded Monitoring Runs</CardTitle>
                <CardDescription>Select a diagnostic session to load reports</CardDescription>
              </div>

              {sessions.length === 0 ? (
                <div className="p-6">
                  <EmptyState
                    title="No historical sessions"
                    description="Run a monitoring probe session to generate statistical archives."
                  />
                </div>
              ) : (
                <div className="divide-y divide-border max-h-[560px] overflow-y-auto">
                  {sessions.map((sess) => {
                    const isSelected = sess.id === activeSessionId;
                    return (
                      <div
                        key={String(sess.id)}
                        onClick={() => setSelectedSessionId(sess.id)}
                        className={`p-3.5 cursor-pointer transition-colors flex items-center justify-between ${
                          isSelected
                            ? 'bg-accent/10 border-l-4 border-accent'
                            : 'hover:bg-surface-secondary/40'
                        }`}
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-xs text-text-primary">
                              {sess.target_name || sess.target_host || 'Target'}
                            </span>
                            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-surface-secondary text-text-muted">
                              {formatSessionId(sess.id)}
                            </span>
                            <StatusBadge status={sess.status} size="sm" />
                          </div>
                          <div className="text-[11px] text-text-muted flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {formatDateTime(sess.start_time)}
                          </div>
                        </div>
                        <ChevronRight className="w-4 h-4 text-text-muted" />
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>
          </div>

          {/* Right Columns: Session Summary & Analytics */}
          <div className="lg:col-span-2 space-y-6">
            {selectedSession ? (
              <>
                {/* Stats Row */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <MetricCard
                    title="Average Latency"
                    value={
                      (stats?.mean_rtt_ms ?? stats?.avg_rtt_ms) !== undefined &&
                      (stats?.mean_rtt_ms ?? stats?.avg_rtt_ms) !== null
                        ? formatMs(stats?.mean_rtt_ms ?? stats?.avg_rtt_ms)
                        : '—'
                    }
                    subtitle={
                      stats?.min_rtt_ms !== null &&
                      stats?.min_rtt_ms !== undefined &&
                      stats?.max_rtt_ms !== null &&
                      stats?.max_rtt_ms !== undefined
                        ? `Min: ${formatNumber(stats.min_rtt_ms, 1)}ms · Max: ${formatNumber(stats.max_rtt_ms, 1)}ms`
                        : stats?.total_probes === 0
                        ? 'No probe samples recorded'
                        : 'Telemetry pending'
                    }
                    status={
                      (() => {
                        const lat = stats?.mean_rtt_ms ?? stats?.avg_rtt_ms;
                        if (lat === null || lat === undefined) return 'unknown';
                        if (lat < 60) return 'good';
                        if (lat < 150) return 'degraded';
                        return 'poor';
                      })()
                    }
                    loading={isLoadingSummary}
                  />

                  <MetricCard
                    title="Average Jitter"
                    value={stats?.jitter_ms !== null && stats?.jitter_ms !== undefined ? formatMs(stats.jitter_ms) : '—'}
                    subtitle="Standard deviation of delay"
                    status={
                      stats?.jitter_ms === null || stats?.jitter_ms === undefined
                        ? 'unknown'
                        : stats.jitter_ms < 30
                        ? 'good'
                        : 'degraded'
                    }
                    loading={isLoadingSummary}
                  />

                  <MetricCard
                    title="Total Packet Loss"
                    value={stats?.packet_loss_pct !== null && stats?.packet_loss_pct !== undefined ? formatPct(stats.packet_loss_pct) : '—'}
                    subtitle={`${stats?.successful_probes ?? 0} of ${stats?.total_probes ?? 0} acknowledged`}
                    status={
                      stats?.packet_loss_pct === null || stats?.packet_loss_pct === undefined
                        ? 'unknown'
                        : stats.packet_loss_pct === 0
                        ? 'good'
                        : 'poor'
                    }
                    loading={isLoadingSummary}
                  />
                </div>

                {/* Latency History Chart */}
                <Card>
                  <CardHeader>
                    <div>
                      <CardTitle>Session Latency Timeline</CardTitle>
                      <CardDescription>
                        Full historical probe sequence ({probes.length} recorded points)
                      </CardDescription>
                    </div>
                  </CardHeader>
                  <LatencyChart data={probes} height={280} showDots={probes.length < 40} />
                </Card>

                {/* Quantiles & Percentiles Breakdown */}
                <Card>
                  <CardHeader>
                    <CardTitle>SLA Statistical Quantiles</CardTitle>
                    <CardDescription>Percentiles & extreme response outliers</CardDescription>
                  </CardHeader>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
                    <div className="p-3 bg-surface-secondary/50 rounded-md">
                      <span className="text-xs text-text-muted">Median (50th %)</span>
                      <p className="text-base font-bold text-text-primary mt-1">
                        {stats?.median_rtt_ms !== null && stats?.median_rtt_ms !== undefined ? formatMs(stats.median_rtt_ms) : '—'}
                      </p>
                    </div>
                    <div className="p-3 bg-surface-secondary/50 rounded-md">
                      <span className="text-xs text-text-muted">95th Percentile</span>
                      <p className="text-base font-bold text-text-primary mt-1">
                        {stats?.p95_rtt_ms !== null && stats?.p95_rtt_ms !== undefined ? formatMs(stats.p95_rtt_ms) : '—'}
                      </p>
                    </div>
                    <div className="p-3 bg-surface-secondary/50 rounded-md">
                      <span className="text-xs text-text-muted">99th Percentile</span>
                      <p className="text-base font-bold text-text-primary mt-1">
                        {stats?.p99_rtt_ms !== null && stats?.p99_rtt_ms !== undefined ? formatMs(stats.p99_rtt_ms) : '—'}
                      </p>
                    </div>
                    <div className="p-3 bg-surface-secondary/50 rounded-md">
                      <span className="text-xs text-text-muted">Alerts Raised</span>
                      <p className="text-base font-bold text-text-primary mt-1">
                        {(summaryData as any)?.alerts_count ??
                          ((summaryData as any)?.alert_counts
                            ? Number(Object.values((summaryData as any).alert_counts).reduce((a: any, b: any) => a + b, 0))
                            : 0)}
                      </p>
                    </div>
                  </div>
                </Card>
              </>
            ) : (
              <Card className="py-12">
                <EmptyState
                  icon={<BarChart3 className="w-8 h-8 text-accent" />}
                  title="No Session Selected"
                  description="Select any recorded session from the left list to review detailed SLA statistics."
                />
              </Card>
            )}
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* SCENARIO 5: HISTORICAL SESSION COMPARISON LAB                 */}
      {/* ============================================================ */}
      {activeTab === 'compare' && (
        <div className="space-y-6">
          {/* Comparison Selector Card */}
          <Card>
            <CardHeader>
              <div>
                <CardTitle>Session Comparison Selector</CardTitle>
                <CardDescription>
                  Select a baseline session and a subsequent session to analyze network performance changes over time
                </CardDescription>
              </div>
            </CardHeader>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="p-4 rounded-lg bg-surface-secondary/40 border border-border space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-text-primary uppercase tracking-wide">
                    Baseline Run (Session A)
                  </span>
                  {sessionA && <StatusBadge status={sessionA.status} size="sm" />}
                </div>
                <Select
                  value={String(sessionAId)}
                  onChange={(e) => setSessionAId(e.target.value)}
                >
                  {sessions.map((s) => (
                    <option key={String(s.id)} value={String(s.id)}>
                      {s.target_name || s.target_host} ({formatSessionId(s.id)} - {new Date(s.start_time).toLocaleDateString()})
                    </option>
                  ))}
                </Select>
                {sessionA && (
                  <p className="text-xs text-text-muted">
                    Started: {formatDateTime(sessionA.start_time)}
                  </p>
                )}
              </div>

              <div className="p-4 rounded-lg bg-accent/5 border border-accent/20 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-accent uppercase tracking-wide">
                    Comparison Run (Session B)
                  </span>
                  {sessionB && <StatusBadge status={sessionB.status} size="sm" />}
                </div>
                <Select
                  value={String(sessionBId)}
                  onChange={(e) => setSessionBId(e.target.value)}
                >
                  {sessions.map((s) => (
                    <option key={String(s.id)} value={String(s.id)}>
                      {s.target_name || s.target_host} ({formatSessionId(s.id)} - {new Date(s.start_time).toLocaleDateString()})
                    </option>
                  ))}
                </Select>
                {sessionB && (
                  <p className="text-xs text-text-muted">
                    Started: {formatDateTime(sessionB.start_time)}
                  </p>
                )}
              </div>
            </div>
          </Card>

          {/* Comparative Metrics Row */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Latency Comparison */}
            <Card className="flex flex-col justify-between">
              <span className="text-xs font-semibold text-text-muted uppercase">Round-Trip Latency Change</span>
              <div className="my-3">
                <div className="flex items-baseline justify-between text-xs text-text-secondary mb-1">
                  <span>Run A: <strong>{latA !== null ? formatMs(latA) : '—'}</strong></span>
                  <span>Run B: <strong>{latB !== null ? formatMs(latB) : '—'}</strong></span>
                </div>
                <div className="flex items-center gap-2 mt-2">
                  {deltaLat !== null ? (
                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-bold ${
                        deltaLat < 0
                          ? 'bg-success-bg text-success-text border border-success/30'
                          : deltaLat > 0
                          ? 'bg-warning-bg text-warning-text border border-warning/30'
                          : 'bg-surface-secondary text-text-secondary border border-border'
                      }`}
                    >
                      {deltaLat < 0 ? (
                        <>
                          <TrendingDown className="w-3.5 h-3.5 text-success" />
                          Improved: {formatNumber(Math.abs(deltaLat), 2)}ms ({formatNumber(Math.abs(pctChangeLat || 0), 1)}%)
                        </>
                      ) : deltaLat > 0 ? (
                        <>
                          <TrendingUp className="w-3.5 h-3.5 text-warning" />
                          Degraded: +{formatNumber(deltaLat, 2)}ms (+{formatNumber(pctChangeLat || 0, 1)}%)
                        </>
                      ) : (
                        <>
                          <Minus className="w-3.5 h-3.5" />
                          No Change (0.0 ms)
                        </>
                      )}
                    </span>
                  ) : (
                    <span className="text-xs text-text-muted">Insufficient telemetry</span>
                  )}
                </div>
              </div>
              <span className="text-[11px] text-text-muted pt-2 border-t border-border">
                Difference in mean round-trip latency
              </span>
            </Card>

            {/* Packet Loss Comparison */}
            <Card className="flex flex-col justify-between">
              <span className="text-xs font-semibold text-text-muted uppercase">Packet Loss Shift</span>
              <div className="my-3">
                <div className="flex items-baseline justify-between text-xs text-text-secondary mb-1">
                  <span>Run A: <strong>{lossA !== null ? formatPct(lossA) : '—'}</strong></span>
                  <span>Run B: <strong>{lossB !== null ? formatPct(lossB) : '—'}</strong></span>
                </div>
                <div className="flex items-center gap-2 mt-2">
                  {deltaLoss !== null ? (
                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-bold ${
                        deltaLoss < 0
                          ? 'bg-success-bg text-success-text border border-success/30'
                          : deltaLoss > 0
                          ? 'bg-critical-bg text-critical-text border border-critical/30'
                          : 'bg-surface-secondary text-text-secondary border border-border'
                      }`}
                    >
                      {deltaLoss < 0 ? (
                        <>
                          <TrendingDown className="w-3.5 h-3.5 text-success" />
                          Decreased Loss: {formatNumber(Math.abs(deltaLoss), 1)}%
                        </>
                      ) : deltaLoss > 0 ? (
                        <>
                          <TrendingUp className="w-3.5 h-3.5 text-critical" />
                          Increased Loss: +{formatNumber(deltaLoss, 1)}%
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="w-3.5 h-3.5 text-success" />
                          Identical Loss Rate ({formatPct(lossA || 0)})
                        </>
                      )}
                    </span>
                  ) : (
                    <span className="text-xs text-text-muted">Insufficient telemetry</span>
                  )}
                </div>
              </div>
              <span className="text-[11px] text-text-muted pt-2 border-t border-border">
                Difference in packet loss percentage
              </span>
            </Card>

            {/* Jitter Comparison */}
            <Card className="flex flex-col justify-between">
              <span className="text-xs font-semibold text-text-muted uppercase">Delay Jitter Variation</span>
              <div className="my-3">
                <div className="flex items-baseline justify-between text-xs text-text-secondary mb-1">
                  <span>Run A: <strong>{jitA !== null ? formatMs(jitA) : '—'}</strong></span>
                  <span>Run B: <strong>{jitB !== null ? formatMs(jitB) : '—'}</strong></span>
                </div>
                <div className="flex items-center gap-2 mt-2">
                  {deltaJit !== null ? (
                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-bold ${
                        deltaJit < 0
                          ? 'bg-success-bg text-success-text border border-success/30'
                          : deltaJit > 0
                          ? 'bg-warning-bg text-warning-text border border-warning/30'
                          : 'bg-surface-secondary text-text-secondary border border-border'
                      }`}
                    >
                      {deltaJit < 0 ? (
                        <>
                          <TrendingDown className="w-3.5 h-3.5 text-success" />
                          Smoother Delay: -{formatNumber(Math.abs(deltaJit), 2)}ms
                        </>
                      ) : deltaJit > 0 ? (
                        <>
                          <TrendingUp className="w-3.5 h-3.5 text-warning" />
                          Higher Variance: +{formatNumber(deltaJit, 2)}ms
                        </>
                      ) : (
                        <>
                          <Minus className="w-3.5 h-3.5" />
                          Identical Jitter (0.0 ms)
                        </>
                      )}
                    </span>
                  ) : (
                    <span className="text-xs text-text-muted">Insufficient telemetry</span>
                  )}
                </div>
              </div>
              <span className="text-[11px] text-text-muted pt-2 border-t border-border">
                Variation in inter-packet delay jitter
              </span>
            </Card>
          </div>

          {/* Statistical Breakdown Comparison Table */}
          <Card noPadding>
            <div className="p-5 border-b border-border">
              <CardTitle>Side-by-Side Statistical Distribution</CardTitle>
              <CardDescription>
                Detailed metric breakdown between Run A ({formatSessionId(sessionAId)}) and Run B ({formatSessionId(sessionBId)})
              </CardDescription>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-surface-secondary/60 text-xs font-semibold text-text-muted border-b border-border">
                  <tr>
                    <th className="py-3 px-4">Metric Parameter</th>
                    <th className="py-3 px-4">Run A (Baseline)</th>
                    <th className="py-3 px-4">Run B (Comparison)</th>
                    <th className="py-3 px-4 text-right">Net Change (Run B - Run A)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border font-mono text-xs">
                  <tr>
                    <td className="py-3 px-4 font-sans font-semibold text-text-primary">Minimum RTT</td>
                    <td className="py-3 px-4">{statsA?.min_rtt_ms !== null && statsA?.min_rtt_ms !== undefined ? formatMs(statsA.min_rtt_ms) : '—'}</td>
                    <td className="py-3 px-4">{statsB?.min_rtt_ms !== null && statsB?.min_rtt_ms !== undefined ? formatMs(statsB.min_rtt_ms) : '—'}</td>
                    <td className="py-3 px-4 text-right">
                      {statsA?.min_rtt_ms !== null && statsB?.min_rtt_ms !== null && statsA?.min_rtt_ms !== undefined && statsB?.min_rtt_ms !== undefined
                        ? `${formatNumber(statsB.min_rtt_ms - statsA.min_rtt_ms, 2)} ms`
                        : '—'}
                    </td>
                  </tr>
                  <tr>
                    <td className="py-3 px-4 font-sans font-semibold text-text-primary">Mean (Average) RTT</td>
                    <td className="py-3 px-4">{latA !== null ? formatMs(latA) : '—'}</td>
                    <td className="py-3 px-4">{latB !== null ? formatMs(latB) : '—'}</td>
                    <td className="py-3 px-4 text-right font-bold">
                      {deltaLat !== null ? `${deltaLat > 0 ? '+' : ''}${formatNumber(deltaLat, 2)} ms` : '—'}
                    </td>
                  </tr>
                  <tr>
                    <td className="py-3 px-4 font-sans font-semibold text-text-primary">Median (50th %) RTT</td>
                    <td className="py-3 px-4">{statsA?.median_rtt_ms !== null && statsA?.median_rtt_ms !== undefined ? formatMs(statsA.median_rtt_ms) : '—'}</td>
                    <td className="py-3 px-4">{statsB?.median_rtt_ms !== null && statsB?.median_rtt_ms !== undefined ? formatMs(statsB.median_rtt_ms) : '—'}</td>
                    <td className="py-3 px-4 text-right">
                      {statsA?.median_rtt_ms !== null && statsB?.median_rtt_ms !== null && statsA?.median_rtt_ms !== undefined && statsB?.median_rtt_ms !== undefined
                        ? `${formatNumber(statsB.median_rtt_ms - statsA.median_rtt_ms, 2)} ms`
                        : '—'}
                    </td>
                  </tr>
                  <tr>
                    <td className="py-3 px-4 font-sans font-semibold text-text-primary">95th Percentile RTT</td>
                    <td className="py-3 px-4">{statsA?.p95_rtt_ms !== null && statsA?.p95_rtt_ms !== undefined ? formatMs(statsA.p95_rtt_ms) : '—'}</td>
                    <td className="py-3 px-4">{statsB?.p95_rtt_ms !== null && statsB?.p95_rtt_ms !== undefined ? formatMs(statsB.p95_rtt_ms) : '—'}</td>
                    <td className="py-3 px-4 text-right">
                      {statsA?.p95_rtt_ms !== null && statsB?.p95_rtt_ms !== null && statsA?.p95_rtt_ms !== undefined && statsB?.p95_rtt_ms !== undefined
                        ? `${formatNumber(statsB.p95_rtt_ms - statsA.p95_rtt_ms, 2)} ms`
                        : '—'}
                    </td>
                  </tr>
                  <tr>
                    <td className="py-3 px-4 font-sans font-semibold text-text-primary">Maximum Outlier RTT</td>
                    <td className="py-3 px-4">{statsA?.max_rtt_ms !== null && statsA?.max_rtt_ms !== undefined ? formatMs(statsA.max_rtt_ms) : '—'}</td>
                    <td className="py-3 px-4">{statsB?.max_rtt_ms !== null && statsB?.max_rtt_ms !== undefined ? formatMs(statsB.max_rtt_ms) : '—'}</td>
                    <td className="py-3 px-4 text-right">
                      {statsA?.max_rtt_ms !== null && statsB?.max_rtt_ms !== null && statsA?.max_rtt_ms !== undefined && statsB?.max_rtt_ms !== undefined
                        ? `${formatNumber(statsB.max_rtt_ms - statsA.max_rtt_ms, 2)} ms`
                        : '—'}
                    </td>
                  </tr>
                  <tr>
                    <td className="py-3 px-4 font-sans font-semibold text-text-primary">Packet Loss Ratio</td>
                    <td className="py-3 px-4">{lossA !== null ? formatPct(lossA) : '—'}</td>
                    <td className="py-3 px-4">{lossB !== null ? formatPct(lossB) : '—'}</td>
                    <td className="py-3 px-4 text-right font-bold">
                      {deltaLoss !== null ? `${deltaLoss > 0 ? '+' : ''}${formatNumber(deltaLoss, 1)}%` : '—'}
                    </td>
                  </tr>
                  <tr>
                    <td className="py-3 px-4 font-sans font-semibold text-text-primary">Probes Transmitted</td>
                    <td className="py-3 px-4">{statsA?.total_probes ?? '—'}</td>
                    <td className="py-3 px-4">{statsB?.total_probes ?? '—'}</td>
                    <td className="py-3 px-4 text-right">
                      {statsA?.total_probes !== undefined && statsB?.total_probes !== undefined
                        ? `${statsB.total_probes - statsA.total_probes} probes`
                        : '—'}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};
