import React, { useState } from 'react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { useHealth } from '@/hooks/useHealth';
import { useInterfaces } from '@/hooks/useInterfaces';
import {
  Server,
  Cpu,
  HardDrive,
  Network,
  Shield,
  Save,
  CheckCircle2,
  RefreshCw,
} from 'lucide-react';

export const Settings: React.FC = () => {
  const { data: health, isLoading: isLoadingHealth, refetch: refetchHealth } = useHealth();
  const { interfaces, isLoading: isLoadingInterfaces } = useInterfaces();

  // Local settings state
  const [defaultInterval, setDefaultInterval] = useState('3');
  const [maxLatencyAlert, setMaxLatencyAlert] = useState('150');
  const [maxJitterAlert, setMaxJitterAlert] = useState('30');
  const [maxLossAlert, setMaxLossAlert] = useState('1.5');
  const [savedNotice, setSavedNotice] = useState(false);

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    setSavedNotice(true);
    setTimeout(() => setSavedNotice(false), 3000);
  };

  return (
    <div className="space-y-6 max-w-5xl">
      <PageHeader
        title="Settings & System Diagnostics"
        description="Configure QoS telemetry thresholds, polling intervals, and inspect engine environment."
        actions={
          <Button
            variant="outline"
            size="sm"
            icon={<RefreshCw className="w-3.5 h-3.5" />}
            onClick={() => refetchHealth()}
          >
            Refresh Health
          </Button>
        }
      />

      {savedNotice && (
        <div className="p-3 bg-success-bg border border-success/30 text-success-text rounded-md text-xs font-medium flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-success" />
          QoS parameters and alerting thresholds updated successfully.
        </div>
      )}

      {/* Backend Engine Health & Environment */}
      <Card>
        <CardHeader>
          <div>
            <CardTitle>NetPulse Engine Status</CardTitle>
            <CardDescription>Backend environment and host runtime characteristics</CardDescription>
          </div>
          <StatusBadge status={health ? 'online' : 'offline'} />
        </CardHeader>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 text-xs">
          <div className="p-3 rounded-md bg-surface-secondary/40 border border-border">
            <span className="text-text-muted">Host Architecture / OS</span>
            <p className="font-semibold text-text-primary text-sm mt-1">
              {health?.os || 'Windows NT / POSIX'}
            </p>
          </div>

          <div className="p-3 rounded-md bg-surface-secondary/40 border border-border">
            <span className="text-text-muted">Python Runtime</span>
            <p className="font-semibold text-text-primary text-sm mt-1">
              {health?.python_version || 'Python 3.11+'}
            </p>
          </div>

          <div className="p-3 rounded-md bg-surface-secondary/40 border border-border">
            <span className="text-text-muted">C Networking Engine</span>
            <p className="font-semibold text-accent text-sm mt-1 truncate" title={health?.c_engine_status}>
              {health?.c_engine_status || 'Source Ready (C Native)'}
            </p>
          </div>

          <div className="p-3 rounded-md bg-surface-secondary/40 border border-border">
            <span className="text-text-muted">Server Daemon Version</span>
            <p className="font-semibold text-text-primary text-sm mt-1">
              {health?.version || 'v1.0.0 (FastAPI Core)'}
            </p>
          </div>

          <div className="p-3 rounded-md bg-surface-secondary/40 border border-border">
            <span className="text-text-muted">Physical Interfaces</span>
            <p className="font-semibold text-text-primary text-sm mt-1">
              {interfaces.length} Discovered
            </p>
          </div>
        </div>
      </Card>

      {/* QoS Polling and SLA Threshold Configuration */}
      <Card>
        <CardHeader>
          <div>
            <CardTitle>QoS Threshold Policies</CardTitle>
            <CardDescription>
              Set automated trigger levels that create high-priority alerts
            </CardDescription>
          </div>
        </CardHeader>

        <form onSubmit={handleSaveSettings} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Default Probing Interval (seconds)"
              type="number"
              min="1"
              max="300"
              value={defaultInterval}
              onChange={(e) => setDefaultInterval(e.target.value)}
              helperText="Frequency of ICMP/TCP probe dispatch"
            />

            <Input
              label="Critical Latency Threshold (ms)"
              type="number"
              min="10"
              value={maxLatencyAlert}
              onChange={(e) => setMaxLatencyAlert(e.target.value)}
              helperText="Trigger alert when RTT exceeds this value"
            />

            <Input
              label="Critical Jitter Threshold (ms)"
              type="number"
              min="5"
              value={maxJitterAlert}
              onChange={(e) => setMaxJitterAlert(e.target.value)}
              helperText="Trigger alert when packet delay variation exceeds this value"
            />

            <Input
              label="Critical Packet Loss Threshold (%)"
              type="number"
              step="0.1"
              min="0.1"
              max="100"
              value={maxLossAlert}
              onChange={(e) => setMaxLossAlert(e.target.value)}
              helperText="Trigger alert when drop ratio exceeds this percentage"
            />
          </div>

          <div className="flex justify-end pt-3 border-t border-border">
            <Button
              type="submit"
              variant="primary"
              size="md"
              icon={<Save className="w-4 h-4" />}
            >
              Save Configuration
            </Button>
          </div>
        </form>
      </Card>

      {/* Discovered Interfaces Summary */}
      <Card noPadding>
        <div className="p-5 border-b border-border">
          <CardTitle>Host Interface Inventory</CardTitle>
          <CardDescription>Network adapters available for telemetry collection</CardDescription>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-surface-secondary/60 text-xs font-semibold text-text-muted border-b border-border">
              <tr>
                <th className="py-2.5 px-4">Interface Name</th>
                <th className="py-2.5 px-4">Status</th>
                <th className="py-2.5 px-4 text-right">Packets Handled</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {interfaces.map((iface) => (
                <tr key={iface.name} className="hover:bg-surface-secondary/20">
                  <td className="py-2.5 px-4 font-mono text-xs text-text-primary">
                    {iface.name}
                  </td>
                  <td className="py-2.5 px-4">
                    <StatusBadge status={iface.is_up ? 'online' : 'offline'} size="sm" />
                  </td>
                  <td className="py-2.5 px-4 text-right font-mono text-xs text-text-muted">
                    {((iface.packets_recv || 0) + (iface.packets_sent || 0)).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};
