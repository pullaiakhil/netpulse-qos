import React, { useState } from 'react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { EmptyState } from '@/components/ui/EmptyState';
import { MetricCard } from '@/components/ui/MetricCard';
import { useAlerts } from '@/hooks/useAlerts';
import { AlertSeverity } from '@/lib/types';
import {
  Bell,
  AlertTriangle,
  AlertCircle,
  Info,
  CheckCircle2,
  Check,
  ShieldCheck,
  ShieldAlert,
  Clock,
  Filter,
} from 'lucide-react';
import { formatDateTime } from '@/lib/utils';

export const Alerts: React.FC = () => {
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'resolved'>('all');
  const [severityFilter, setSeverityFilter] = useState<string>('all');

  const { alerts, acknowledgeAlert, resolveAlert, isLoading } = useAlerts(
    severityFilter !== 'all' ? { severity: severityFilter } : undefined
  );

  const filteredAlerts = alerts.filter((a) => {
    const isResolved = Boolean(a.resolved || a.resolved_at);
    if (statusFilter === 'active' && isResolved) return false;
    if (statusFilter === 'resolved' && !isResolved) return false;
    if (severityFilter !== 'all' && a.severity !== severityFilter) return false;
    return true;
  });

  const activeCount = alerts.filter((a) => !Boolean(a.resolved || a.resolved_at)).length;
  const resolvedCount = alerts.filter((a) => Boolean(a.resolved || a.resolved_at)).length;
  const criticalCount = alerts.filter((a) => a.severity === 'critical' && !Boolean(a.resolved || a.resolved_at)).length;

  const getSeverityBadge = (severity: AlertSeverity) => {
    switch (severity) {
      case 'critical':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-critical-bg text-critical-text border border-critical/30">
            <AlertCircle className="w-3.5 h-3.5" /> Critical
          </span>
        );
      case 'warning':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-warning-bg text-warning-text border border-warning/30">
            <AlertTriangle className="w-3.5 h-3.5" /> Warning
          </span>
        );
      case 'info':
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-info-bg text-info-text border border-info/30">
            <Info className="w-3.5 h-3.5" /> Info
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="QoS SLA Alerts & Threshold Breaches"
        description="Stateful SLA violation monitor with hysteresis cooldown counters to prevent alert spam."
        actions={
          <div className="flex flex-wrap items-center gap-3">
            {/* Status Filter Pills */}
            <div className="inline-flex rounded-lg border border-border bg-surface-secondary/40 p-0.5">
              <button
                type="button"
                onClick={() => setStatusFilter('all')}
                className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors ${
                  statusFilter === 'all'
                    ? 'bg-white text-accent shadow-sm'
                    : 'text-text-secondary hover:text-text-primary'
                }`}
              >
                All ({alerts.length})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('active')}
                className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors ${
                  statusFilter === 'active'
                    ? 'bg-white text-critical shadow-sm'
                    : 'text-text-secondary hover:text-text-primary'
                }`}
              >
                Active ({activeCount})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('resolved')}
                className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors ${
                  statusFilter === 'resolved'
                    ? 'bg-white text-success shadow-sm'
                    : 'text-text-secondary hover:text-text-primary'
                }`}
              >
                Resolved ({resolvedCount})
              </button>
            </div>

            <div className="w-40">
              <Select
                value={severityFilter}
                onChange={(e) => setSeverityFilter(e.target.value)}
                options={[
                  { value: 'all', label: 'All Severities' },
                  { value: 'critical', label: 'Critical Only' },
                  { value: 'warning', label: 'Warning Only' },
                  { value: 'info', label: 'Informational' },
                ]}
              />
            </div>
          </div>
        }
      />

      {/* Summary Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <MetricCard
          title="Active SLA Violations"
          value={activeCount}
          unit=""
          subtitle={activeCount > 0 ? `${criticalCount} critical incidents open` : 'All metrics within thresholds'}
          status={activeCount === 0 ? 'good' : criticalCount > 0 ? 'poor' : 'degraded'}
          icon={<AlertCircle className={`w-4 h-4 ${activeCount > 0 ? 'text-critical' : 'text-success'}`} />}
          loading={isLoading}
        />

        <MetricCard
          title="Auto-Resolved Incidents"
          value={resolvedCount}
          unit=""
          subtitle="Stabilized after cooldown intervals"
          status="good"
          icon={<ShieldCheck className="w-4 h-4 text-success" />}
          loading={isLoading}
        />

        <MetricCard
          title="Total Lifetime Alerts"
          value={alerts.length}
          unit=""
          subtitle="Audit log of all triggered events"
          status="good"
          icon={<Bell className="w-4 h-4 text-text-secondary" />}
          loading={isLoading}
        />
      </div>

      {/* Anti-Spam Hysteresis Explanation Banner */}
      <div className="p-3.5 rounded-lg bg-surface-secondary/70 border border-border text-xs text-text-secondary flex items-start gap-2.5">
        <Info className="w-4 h-4 text-accent shrink-0 mt-0.5" />
        <div>
          <span className="font-semibold text-text-primary">Hysteresis Cooldown & Flap Prevention: </span>
          The QoS alert engine requires 3 consecutive sampling violations before raising an incident, and 3 consecutive compliant readings before auto-resolving. This ensures single-packet jitter spikes do not generate false alert noise.
        </div>
      </div>

      {/* Incidents Table */}
      <Card noPadding>
        <div className="p-5 border-b border-border flex items-center justify-between">
          <div>
            <CardTitle>Security & SLA Violations Feed</CardTitle>
            <CardDescription>
              Displaying {filteredAlerts.length} recorded incidents matching current filters
            </CardDescription>
          </div>
        </div>

        {filteredAlerts.length === 0 ? (
          <div className="p-8">
            <EmptyState
              icon={<ShieldCheck className="w-8 h-8 text-success" />}
              title="No matching alerts recorded."
              description={
                statusFilter === 'active'
                  ? 'No active threshold violations. Network is performing within configured SLA limits.'
                  : 'All latency, packet loss, and jitter telemetry points are within normal parameters.'
              }
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-surface-secondary/60 text-xs font-semibold text-text-muted border-b border-border">
                <tr>
                  <th className="py-3 px-4">Severity</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Timestamp</th>
                  <th className="py-3 px-4">Target</th>
                  <th className="py-3 px-4">Metric</th>
                  <th className="py-3 px-4">Measured vs Limit</th>
                  <th className="py-3 px-4">Diagnostic Details</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredAlerts.map((alt) => {
                  const isResolved = Boolean(alt.resolved || alt.resolved_at);
                  const observedVal = alt.observed_value ?? alt.actual_value ?? 0;
                  const unitStr = alt.unit || (alt.metric === 'packet_loss' ? '%' : 'ms');

                  return (
                    <tr
                      key={String(alt.id)}
                      className={`hover:bg-surface-secondary/20 transition-colors ${
                        isResolved ? 'opacity-70 bg-surface-secondary/10' : ''
                      }`}
                    >
                      <td className="py-3 px-4">{getSeverityBadge(alt.severity)}</td>
                      <td className="py-3 px-4">
                        {isResolved ? (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-success">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Resolved
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-critical animate-pulse">
                            <AlertCircle className="w-3.5 h-3.5" /> Active
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-xs font-mono text-text-muted whitespace-nowrap">
                        {formatDateTime(alt.timestamp)}
                      </td>
                      <td className="py-3 px-4 font-semibold text-xs text-text-primary">
                        {alt.target_name || `Session #${alt.session_id}`}
                      </td>
                      <td className="py-3 px-4 uppercase text-xs font-semibold text-text-secondary">
                        {alt.metric}
                      </td>
                      <td className="py-3 px-4 text-xs font-mono">
                        <span className="font-semibold text-critical">
                          {observedVal} {unitStr}
                        </span>{' '}
                        <span className="text-text-muted">/ limit {alt.threshold_value} {unitStr}</span>
                      </td>
                      <td className="py-3 px-4 text-xs text-text-secondary max-w-xs truncate" title={alt.message}>
                        {alt.message}
                      </td>
                      <td className="py-3 px-4 text-right space-x-2 whitespace-nowrap">
                        {!alt.acknowledged && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => acknowledgeAlert(String(alt.id))}
                          >
                            Ack
                          </Button>
                        )}
                        {!isResolved ? (
                          <Button
                            variant="secondary"
                            size="sm"
                            icon={<Check className="w-3.5 h-3.5 text-success" />}
                            onClick={() => resolveAlert(String(alt.id))}
                          >
                            Resolve
                          </Button>
                        ) : (
                          <span className="text-[11px] font-mono text-text-muted">
                            {alt.resolved_at ? new Date(alt.resolved_at).toLocaleTimeString() : 'Auto-resolved'}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
};
