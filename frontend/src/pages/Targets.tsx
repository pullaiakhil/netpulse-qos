import React, { useState } from 'react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Dialog } from '@/components/ui/Dialog';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { EmptyState } from '@/components/ui/EmptyState';
import { useTargets } from '@/hooks/useTargets';
import { Target, ProbeType } from '@/lib/types';
import { api } from '@/lib/api';
import {
  Plus,
  Trash2,
  Activity,
  CheckCircle2,
  XCircle,
  ExternalLink,
  Layers,
  Radio,
  Server,
  Zap,
} from 'lucide-react';
import { formatDateTime, getTargetProtocol, formatNumber } from '@/lib/utils';

export const Targets: React.FC = () => {
  const { data: targets = [], isLoading, createTarget, isCreating, deleteTarget, updateTarget } =
    useTargets();

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState<string | number | null>(null);

  // Form states
  const [name, setName] = useState('');
  const [host, setHost] = useState('');
  const [type, setType] = useState<ProbeType>('icmp');
  const [port, setPort] = useState<number | ''>(80);
  const [formError, setFormError] = useState<string | null>(null);

  // Connectivity test state
  const [testingTargetId, setTestingTargetId] = useState<string | number | null>(null);
  const [testResult, setTestResult] = useState<{ id: string | number; success: boolean; rtt?: number; msg?: string } | null>(null);

  const handleOpenAdd = () => {
    setName('');
    setHost('');
    setType('icmp');
    setPort(80);
    setFormError(null);
    setIsAddOpen(true);
  };

  const handleCreateTarget = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!name.trim()) {
      setFormError('Target display name is required.');
      return;
    }
    if (!host.trim()) {
      setFormError('Host address or domain is required.');
      return;
    }

    try {
      await createTarget({
        name: name.trim(),
        host: host.trim(),
        type,
        port: type !== 'icmp' && port ? Number(port) : undefined,
        enabled: true,
      });
      setIsAddOpen(false);
    } catch (err: any) {
      setFormError(err.message || 'Failed to register target.');
    }
  };

  const handleDelete = async () => {
    if (!deleteTargetId) return;
    try {
      await deleteTarget(String(deleteTargetId));
      setDeleteTargetId(null);
    } catch (err: any) {
      alert(`Error deleting target: ${err.message}`);
    }
  };

  const handleTestConnectivity = async (target: Target) => {
    setTestingTargetId(target.id);
    setTestResult(null);

    try {
      if (target.type === 'tcp' || target.type === 'http') {
        const portToTest = target.port || (target.type === 'http' ? 80 : 443);
        const res = await api.runTcpTest({ host: target.host, port: portToTest });
        setTestResult({
          id: target.id,
          success: res.success,
          rtt: res.rtt_ms || undefined,
          msg: res.success
            ? `Connected in ${formatNumber(res.rtt_ms, 1)}ms`
            : (res.error || 'Connection failed'),
        });
      } else {
        // Genuine ICMP Ping test via backend /tests/ping
        const res = await api.runPingTest({ host: target.host, count: 2 });
        const success = res.received > 0;
        const rtt = res.mean_rtt_ms ?? (res.probes?.[0]?.rtt_ms || undefined);
        setTestResult({
          id: target.id,
          success,
          rtt,
          msg: success
            ? `ICMP Echo Reply (${rtt !== undefined && rtt !== null ? `${formatNumber(rtt, 1)}ms` : 'received'}, ${formatNumber(res.packet_loss_pct, 1)}% loss)`
            : 'Host unreachable / timed out',
        });
      }
    } catch (err: any) {
      setTestResult({
        id: target.id,
        success: false,
        msg: err.message || 'Unreachable',
      });
    } finally {
      setTestingTargetId(null);
    }
  };

  const handleToggleEnable = async (target: Target) => {
    try {
      await updateTarget({
        id: String(target.id),
        data: { enabled: !target.enabled },
      });
    } catch (err: any) {
      alert(`Could not toggle target: ${err.message}`);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Monitoring Targets"
        description="Configure remote destinations, servers, and gateway IP endpoints for QoS probes."
        actions={
          <Button
            variant="primary"
            size="md"
            icon={<Plus className="w-4 h-4" />}
            onClick={handleOpenAdd}
          >
            Add New Target
          </Button>
        }
      />

      {/* Target Table */}
      <Card noPadding>
        <div className="p-5 border-b border-border">
          <CardTitle>Configured Destinations</CardTitle>
          <CardDescription>
            Targets are probed via ICMP Echo, TCP SYN Handshake, or HTTP Requests
          </CardDescription>
        </div>

        {targets.length === 0 ? (
          <div className="p-6">
            <EmptyState
              icon={<Server className="w-8 h-8 text-accent" />}
              title="No Targets Configured"
              description="Add your first monitoring target (e.g. 8.8.8.8, 1.1.1.1, or an internal gateway) to get started."
              action={
                <Button variant="primary" size="sm" onClick={handleOpenAdd}>
                  Add First Target
                </Button>
              }
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-surface-secondary/60 text-xs font-semibold text-text-muted border-b border-border">
                <tr>
                  <th className="py-3 px-4">Target Name</th>
                  <th className="py-3 px-4">Host / IP</th>
                  <th className="py-3 px-4">Probe Type</th>
                  <th className="py-3 px-4">Port</th>
                  <th className="py-3 px-4">Active</th>
                  <th className="py-3 px-4">Diagnostics</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {targets.map((target) => (
                  <tr key={target.id} className="hover:bg-surface-secondary/20 transition-colors">
                    <td className="py-3 px-4 font-medium text-text-primary">
                      {target.name}
                    </td>
                    <td className="py-3 px-4 font-mono text-xs text-text-secondary">
                      {target.host}
                    </td>
                    <td className="py-3 px-4">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold uppercase bg-surface-secondary text-text-primary border border-border">
                        {getTargetProtocol(target)}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-mono text-xs text-text-muted">
                      {target.port || '—'}
                    </td>
                    <td className="py-3 px-4">
                      <button
                        onClick={() => handleToggleEnable(target)}
                        className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                          target.enabled ? 'bg-accent' : 'bg-border'
                        }`}
                        title={target.enabled ? 'Disable target' : 'Enable target'}
                      >
                        <span
                          className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                            target.enabled ? 'translate-x-4' : 'translate-x-0'
                          }`}
                        />
                      </button>
                    </td>
                    <td className="py-3 px-4">
                      {testResult && testResult.id === target.id ? (
                        <div className="flex items-center gap-1.5 text-xs">
                          {testResult.success ? (
                            <span className="text-success font-medium flex items-center gap-1">
                              <CheckCircle2 className="w-3.5 h-3.5" /> {testResult.msg}
                            </span>
                          ) : (
                            <span className="text-critical font-medium flex items-center gap-1">
                              <XCircle className="w-3.5 h-3.5" /> {testResult.msg}
                            </span>
                          )}
                        </div>
                      ) : (
                        <Button
                          variant="secondary"
                          size="sm"
                          icon={<Zap className="w-3.5 h-3.5 text-accent" />}
                          loading={testingTargetId === target.id}
                          onClick={() => handleTestConnectivity(target)}
                        >
                          Ping Test
                        </Button>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-text-muted hover:text-critical"
                        onClick={() => setDeleteTargetId(target.id)}
                        icon={<Trash2 className="w-4 h-4" />}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Add Target Modal Dialog */}
      <Dialog
        isOpen={isAddOpen}
        onClose={() => setIsAddOpen(false)}
        title="Register New Monitoring Target"
        description="Enter endpoint connectivity parameters to configure active QoS probing."
        footer={
          <>
            <Button variant="secondary" onClick={() => setIsAddOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              loading={isCreating}
              onClick={handleCreateTarget}
            >
              Save Target
            </Button>
          </>
        }
      >
        <form onSubmit={handleCreateTarget} className="space-y-4">
          {formError && (
            <div className="p-3 text-xs bg-critical-bg text-critical-text rounded border border-critical/30">
              {formError}
            </div>
          )}

          <Input
            label="Target Friendly Name"
            placeholder="e.g. Primary Cloud Gateway, DNS-1"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />

          <Input
            label="Host Address / Domain / IP"
            placeholder="e.g. 8.8.8.8 or gateway.local"
            value={host}
            onChange={(e) => setHost(e.target.value)}
            required
          />

          <Select
            label="Probe Protocol"
            value={type}
            onChange={(e) => setType(e.target.value as ProbeType)}
            options={[
              { value: 'icmp', label: 'ICMP (Ping / Echo Request)' },
              { value: 'tcp', label: 'TCP (Port Handshake Syn/Ack)' },
              { value: 'http', label: 'HTTP (Web Endpoint Probe)' },
            ]}
          />

          {type !== 'icmp' && (
            <Input
              label="Port"
              type="number"
              placeholder={type === 'http' ? '80 or 443' : '443'}
              value={port}
              onChange={(e) => setPort(e.target.value ? Number(e.target.value) : '')}
            />
          )}
        </form>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        isOpen={!!deleteTargetId}
        onClose={() => setDeleteTargetId(null)}
        title="Confirm Target Deletion"
        description="Are you sure you want to remove this monitoring target? Historical probe logs will be preserved."
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleteTargetId(null)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={handleDelete}>
              Delete Target
            </Button>
          </>
        }
      >
        <p className="text-sm text-text-secondary">
          This operation cannot be undone. Any active sessions for this target will be halted.
        </p>
      </Dialog>
    </div>
  );
};
