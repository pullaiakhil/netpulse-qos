import React, { useState } from 'react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { QoSProfile, QoSStatus } from '@/lib/types';
import { useMonitoring } from '@/hooks/useMonitoring';
import {
  ShieldCheck,
  Video,
  PhoneCall,
  Gamepad2,
  Globe,
  DownloadCloud,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  HelpCircle,
} from 'lucide-react';
import { formatMs, formatPct } from '@/lib/utils';

interface StandardProfile extends QoSProfile {
  icon: React.ComponentType<{ className?: string }>;
}

const DEFAULT_PROFILES: StandardProfile[] = [
  {
    id: 'voip',
    name: 'VoIP (Voice over IP)',
    description: 'Ultra-low latency and jitter requirements for crystal clear speech audio.',
    max_latency_ms: 150,
    max_jitter_ms: 30,
    max_packet_loss_pct: 1.0,
    icon: PhoneCall,
  },
  {
    id: 'video',
    name: 'Video Conferencing (Zoom/Teams)',
    description: 'Interactive two-way video communication requiring stable frames and low jitter.',
    max_latency_ms: 200,
    max_jitter_ms: 40,
    max_packet_loss_pct: 2.0,
    icon: Video,
  },
  {
    id: 'gaming',
    name: 'Online Gaming',
    description: 'Requires rapid packet responsiveness and negligible delay variance.',
    max_latency_ms: 50,
    max_jitter_ms: 15,
    max_packet_loss_pct: 0.5,
    icon: Gamepad2,
  },
  {
    id: 'browsing',
    name: 'Web Browsing & SaaS',
    description: 'Standard HTTP/HTTPS interactive web applications.',
    max_latency_ms: 300,
    max_jitter_ms: 100,
    max_packet_loss_pct: 3.0,
    icon: Globe,
  },
  {
    id: 'download',
    name: 'Bulk File Download',
    description: 'High throughput tolerance with generous latency buffers.',
    max_latency_ms: 500,
    max_jitter_ms: 150,
    max_packet_loss_pct: 5.0,
    icon: DownloadCloud,
  },
];

export const QoSAssessment: React.FC = () => {
  const { isRunning, metrics } = useMonitoring(3000);
  const [profiles, setProfiles] = useState<StandardProfile[]>(DEFAULT_PROFILES);
  const [selectedProfileId, setSelectedProfileId] = useState<string>('video');

  const profile = profiles.find((p) => p.id === selectedProfileId) || profiles[0];
  const probes = metrics?.probes || [];

  // Compute stats from active probes
  const validProbes = probes.filter((p) => p.rtt_ms !== null);
  const avgLatency =
    validProbes.length > 0
      ? validProbes.reduce((sum, p) => sum + (p.rtt_ms || 0), 0) / validProbes.length
      : null;

  const avgJitter =
    probes.length > 0
      ? probes.reduce((sum, p) => sum + (p.jitter_ms || 0), 0) / probes.length
      : null;

  const avgLoss =
    probes.length > 0
      ? ((probes.filter((p) => !p.success).length) / probes.length) * 100
      : null;

  // Evaluation logic
  const evaluateMetric = (
    val: number | null,
    limit: number,
    isLoss = false
  ): { status: QoSStatus; text: string } => {
    if (val === null || !isRunning || probes.length === 0) {
      return { status: 'insufficient_data', text: 'No live telemetry' };
    }
    if (val <= limit * 0.8) {
      return { status: 'good', text: 'Compliant' };
    }
    if (val <= limit) {
      return { status: 'degraded', text: 'Borderline' };
    }
    return { status: 'poor', text: 'Breached Threshold' };
  };

  const latencyEval = evaluateMetric(avgLatency, profile.max_latency_ms);
  const jitterEval = evaluateMetric(avgJitter, profile.max_jitter_ms);
  const lossEval = evaluateMetric(avgLoss, profile.max_packet_loss_pct, true);

  // Overall calculation
  let overallStatus: QoSStatus = 'insufficient_data';
  let overallScore = 100;

  if (probes.length > 0 && isRunning) {
    if (
      latencyEval.status === 'poor' ||
      jitterEval.status === 'poor' ||
      lossEval.status === 'poor'
    ) {
      overallStatus = 'poor';
      overallScore = 45;
    } else if (
      latencyEval.status === 'degraded' ||
      jitterEval.status === 'degraded' ||
      lossEval.status === 'degraded'
    ) {
      overallStatus = 'degraded';
      overallScore = 75;
    } else {
      overallStatus = 'good';
      overallScore = 95;
    }
  }

  const ProfileIcon = profile.icon;

  return (
    <div className="space-y-6">
      <PageHeader
        title="QoS Assessment & SLA Compliance"
        description="Verify service quality thresholds against industry ITU-T G.1010 and RFC QoS profiles."
        actions={
          <div className="w-64">
            <Select
              value={selectedProfileId}
              onChange={(e) => setSelectedProfileId(e.target.value)}
            >
              {profiles.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
          </div>
        }
      />

      {/* Main Overall Score Card */}
      <Card className="bg-gradient-to-r from-white to-surface-secondary/50">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="p-3.5 bg-accent-light text-accent rounded-lg">
              <ProfileIcon className="w-8 h-8" />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h2 className="text-lg font-bold text-text-primary">{profile.name}</h2>
                <StatusBadge status={overallStatus} size="md" />
              </div>
              <p className="text-xs text-text-secondary mt-1 max-w-xl">{profile.description}</p>
            </div>
          </div>

          <div className="flex items-center gap-4 border-t sm:border-t-0 sm:border-l border-border pt-4 sm:pt-0 sm:pl-6">
            <div className="text-right sm:text-left">
              <span className="text-xs text-text-muted font-medium uppercase tracking-wide">
                Quality Index
              </span>
              <div className="flex items-baseline gap-1 mt-0.5">
                <span className="text-3xl font-extrabold text-text-primary tabular-nums">
                  {overallStatus === 'insufficient_data' ? '—' : overallScore}
                </span>
                <span className="text-xs text-text-muted">/ 100</span>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Breakdown per metric */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Latency */}
        <Card className="space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-border">
            <span className="text-xs font-semibold text-text-muted uppercase">Latency (RTT)</span>
            <StatusBadge status={latencyEval.status} size="sm" />
          </div>

          <div className="space-y-1">
            <div className="flex items-baseline justify-between">
              <span className="text-xs text-text-secondary">Measured Live Average:</span>
              <span className="text-lg font-bold tabular-nums text-text-primary">
                {avgLatency !== null ? formatMs(avgLatency) : '—'}
              </span>
            </div>
            <div className="flex items-baseline justify-between">
              <span className="text-xs text-text-secondary">Profile Maximum SLA:</span>
              <span className="text-xs font-medium text-text-muted font-mono">
                {profile.max_latency_ms} ms
              </span>
            </div>
          </div>

          <div className="p-2.5 bg-surface-secondary rounded-md text-xs text-text-secondary">
            Evaluation: <span className="font-semibold text-text-primary">{latencyEval.text}</span>
          </div>
        </Card>

        {/* Jitter */}
        <Card className="space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-border">
            <span className="text-xs font-semibold text-text-muted uppercase">Packet Jitter</span>
            <StatusBadge status={jitterEval.status} size="sm" />
          </div>

          <div className="space-y-1">
            <div className="flex items-baseline justify-between">
              <span className="text-xs text-text-secondary">Measured Live Average:</span>
              <span className="text-lg font-bold tabular-nums text-text-primary">
                {avgJitter !== null ? formatMs(avgJitter) : '—'}
              </span>
            </div>
            <div className="flex items-baseline justify-between">
              <span className="text-xs text-text-secondary">Profile Maximum SLA:</span>
              <span className="text-xs font-medium text-text-muted font-mono">
                {profile.max_jitter_ms} ms
              </span>
            </div>
          </div>

          <div className="p-2.5 bg-surface-secondary rounded-md text-xs text-text-secondary">
            Evaluation: <span className="font-semibold text-text-primary">{jitterEval.text}</span>
          </div>
        </Card>

        {/* Packet Loss */}
        <Card className="space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-border">
            <span className="text-xs font-semibold text-text-muted uppercase">Packet Loss</span>
            <StatusBadge status={lossEval.status} size="sm" />
          </div>

          <div className="space-y-1">
            <div className="flex items-baseline justify-between">
              <span className="text-xs text-text-secondary">Measured Loss Ratio:</span>
              <span className="text-lg font-bold tabular-nums text-text-primary">
                {avgLoss !== null ? formatPct(avgLoss) : '—'}
              </span>
            </div>
            <div className="flex items-baseline justify-between">
              <span className="text-xs text-text-secondary">Profile Maximum SLA:</span>
              <span className="text-xs font-medium text-text-muted font-mono">
                {profile.max_packet_loss_pct}%
              </span>
            </div>
          </div>

          <div className="p-2.5 bg-surface-secondary rounded-md text-xs text-text-secondary">
            Evaluation: <span className="font-semibold text-text-primary">{lossEval.text}</span>
          </div>
        </Card>
      </div>

      {/* Profiles Comparison Matrix */}
      <Card noPadding>
        <div className="p-5 border-b border-border">
          <CardTitle>QoS Standards Benchmark Matrix</CardTitle>
          <CardDescription>
            Performance boundaries across typical application traffic categories
          </CardDescription>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-surface-secondary/60 text-xs font-semibold text-text-muted border-b border-border">
              <tr>
                <th className="py-3 px-4">Application Profile</th>
                <th className="py-3 px-4">Max RTT Latency</th>
                <th className="py-3 px-4">Max Delay Jitter</th>
                <th className="py-3 px-4">Max Packet Loss</th>
                <th className="py-3 px-4 text-right">Suitability</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {profiles.map((p) => {
                const isCurrent = p.id === selectedProfileId;
                const Icon = p.icon;
                return (
                  <tr
                    key={p.id}
                    className={`transition-colors cursor-pointer ${
                      isCurrent ? 'bg-accent-light/40 font-medium' : 'hover:bg-surface-secondary/30'
                    }`}
                    onClick={() => setSelectedProfileId(p.id)}
                  >
                    <td className="py-3 px-4 flex items-center gap-2.5">
                      <Icon className="w-4 h-4 text-accent" />
                      <span className="text-text-primary">{p.name}</span>
                    </td>
                    <td className="py-3 px-4 font-mono text-xs">{p.max_latency_ms} ms</td>
                    <td className="py-3 px-4 font-mono text-xs">{p.max_jitter_ms} ms</td>
                    <td className="py-3 px-4 font-mono text-xs">{p.max_packet_loss_pct}%</td>
                    <td className="py-3 px-4 text-right">
                      {isCurrent ? (
                        <StatusBadge status={overallStatus} size="sm" />
                      ) : (
                        <span className="text-xs text-text-muted">Click to assess</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};
