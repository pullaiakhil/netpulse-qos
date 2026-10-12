import React, { useState } from 'react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { MetricCard } from '@/components/ui/MetricCard';
import { ThroughputChart } from '@/components/charts/ThroughputChart';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useInterfaces } from '@/hooks/useInterfaces';
import { formatBytes, formatKbps, formatNumber } from '@/lib/utils';
import { api } from '@/lib/api';
import { IperfTestResult } from '@/lib/types';
import {
  ArrowDownLeft,
  ArrowUpRight,
  RefreshCw,
  Network,
  Activity,
  HardDrive,
  Info,
  Zap,
  ShieldAlert,
  CheckCircle2,
  AlertTriangle,
  Server,
  Play,
  Clock,
} from 'lucide-react';

export const ThroughputAnalysis: React.FC = () => {
  const { interfaces, throughputData, historicalThroughput, refetch, isLoading } =
    useInterfaces(3000);

  const [activeTab, setActiveTab] = useState<'interface' | 'controlled'>('interface');
  const [selectedInterface, setSelectedInterface] = useState<string>('all');

  // Controlled iperf3 test state
  const [iperfHost, setIperfHost] = useState('127.0.0.1');
  const [iperfPort, setIperfPort] = useState(5201);
  const [iperfDuration, setIperfDuration] = useState(5);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [isRunningIperf, setIsRunningIperf] = useState(false);
  const [iperfResult, setIperfResult] = useState<IperfTestResult | null>(null);

  const filteredThroughput =
    selectedInterface === 'all'
      ? historicalThroughput
      : historicalThroughput.filter((t) => t.interface_name === selectedInterface);

  // Compute current total Rx/Tx in kbps and Mbps
  const latestReadings = throughputData.filter(
    (t) => selectedInterface === 'all' || t.interface_name === selectedInterface
  );

  const currentRxKbps = latestReadings.reduce((acc, curr) => acc + (curr.rx_kbps || 0), 0);
  const currentTxKbps = latestReadings.reduce((acc, curr) => acc + (curr.tx_kbps || 0), 0);
  const currentRxMbps = currentRxKbps / 1000.0;
  const currentTxMbps = currentTxKbps / 1000.0;

  const totalRxBytes = interfaces.reduce((acc, curr) => acc + (curr.bytes_recv || 0), 0);
  const totalTxBytes = interfaces.reduce((acc, curr) => acc + (curr.bytes_sent || 0), 0);

  const handleRunIperf = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAuthorized) {
      alert('You must acknowledge that this is an authorized target endpoint before executing an active bandwidth test.');
      return;
    }

    setIsRunningIperf(true);
    setIperfResult(null);

    try {
      const res = await api.runIperfTest({
        host: iperfHost.trim(),
        port: Number(iperfPort),
        duration_seconds: Number(iperfDuration),
        authorized: true,
      });
      setIperfResult(res);
    } catch (err: any) {
      setIperfResult({
        available: false,
        success: false,
        host: iperfHost,
        port: iperfPort,
        duration_seconds: iperfDuration,
        requirements_note: 'Controlled throughput test execution failed.',
        error_type: 'REQUEST_ERROR',
        error_detail: err.message || 'Failed to connect to backend endpoint',
        timestamp: new Date().toISOString(),
      });
    } finally {
      setIsRunningIperf(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Throughput & Bandwidth Diagnostics"
        description="Monitor physical and virtual interface traffic in Mbps and execute guarded controlled bandwidth benchmarks."
        actions={
          <div className="flex items-center gap-2">
            <div className="inline-flex rounded-lg border border-border bg-surface-secondary/40 p-0.5">
              <button
                type="button"
                onClick={() => setActiveTab('interface')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                  activeTab === 'interface'
                    ? 'bg-white text-accent shadow-sm'
                    : 'text-text-secondary hover:text-text-primary'
                }`}
              >
                Live Adapter Telemetry
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('controlled')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                  activeTab === 'controlled'
                    ? 'bg-white text-accent shadow-sm'
                    : 'text-text-secondary hover:text-text-primary'
                }`}
              >
                Controlled Throughput (iperf3)
              </button>
            </div>
            {activeTab === 'interface' && (
              <Button
                variant="outline"
                size="sm"
                icon={<RefreshCw className="w-3.5 h-3.5" />}
                onClick={() => refetch()}
              >
                Refresh
              </Button>
            )}
          </div>
        }
      />

      {/* ============================================================ */}
      {/* SCENARIO 3: LIVE INTERFACE THROUGHPUT TELEMETRY              */}
      {/* ============================================================ */}
      {activeTab === 'interface' && (
        <div className="space-y-6">
          {/* Important Distinction Banner */}
          <div className="p-4 rounded-lg bg-surface-secondary/70 border border-border text-xs text-text-secondary flex items-start gap-3">
            <Info className="w-5 h-5 text-accent shrink-0 mt-0.5" />
            <div className="space-y-1">
              <span className="font-semibold text-text-primary block">
                Network Interface Throughput vs Internet Speed
              </span>
              <p>
                This telemetry reads real-time OS network interface byte counters (<code className="font-mono bg-white px-1 py-0.5 rounded border border-border">psutil.net_io_counters</code>) to calculate instantaneous inbound and outbound bitrates in <strong>Mbps</strong>.
                Interface throughput measures all adapter data traffic (local area network, inter-process communication, local streaming, background syncing), which is independent of your ISP internet package speed or external WAN limits.
              </p>
            </div>
          </div>

          {/* Interface Selector & Actions */}
          <div className="flex items-center justify-between gap-4">
            <div className="w-64">
              <Select
                label="Selected Adapter"
                value={selectedInterface}
                onChange={(e) => setSelectedInterface(e.target.value)}
              >
                <option value="all">All Adapters (Aggregated Sum)</option>
                {interfaces.map((iface) => (
                  <option key={iface.name} value={iface.name}>
                    {iface.name} {iface.is_up ? '(UP)' : '(DOWN)'}
                  </option>
                ))}
              </Select>
            </div>
            <span className="text-xs text-text-muted self-end pb-2">
              Polling sampling window: 3s
            </span>
          </div>

          {/* Metric Cards Row in Mbps */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <MetricCard
              title="Inbound Rate (Rx)"
              value={`${formatNumber(currentRxMbps, 3)} Mbps`}
              unit=""
              subtitle={`${formatKbps(currentRxKbps)} · Adapter download rate`}
              status="good"
              icon={<ArrowDownLeft className="w-4 h-4 text-success" />}
              loading={isLoading}
            />

            <MetricCard
              title="Outbound Rate (Tx)"
              value={`${formatNumber(currentTxMbps, 3)} Mbps`}
              unit=""
              subtitle={`${formatKbps(currentTxKbps)} · Adapter upload rate`}
              status="good"
              icon={<ArrowUpRight className="w-4 h-4 text-accent" />}
              loading={isLoading}
            />

            <MetricCard
              title="Total Bytes Received"
              value={formatBytes(totalRxBytes)}
              unit=""
              subtitle="Aggregated interface ingress payload"
              status="good"
              icon={<HardDrive className="w-4 h-4 text-text-secondary" />}
              loading={isLoading}
            />

            <MetricCard
              title="Total Bytes Sent"
              value={formatBytes(totalTxBytes)}
              unit=""
              subtitle="Aggregated interface egress payload"
              status="good"
              icon={<HardDrive className="w-4 h-4 text-text-secondary" />}
              loading={isLoading}
            />
          </div>

          {/* Main Bandwidth Stream Chart */}
          <Card>
            <CardHeader>
              <div>
                <CardTitle>Adapter Bitrate Timeline (Rx vs Tx)</CardTitle>
                <CardDescription>
                  Continuous transmission rate calculated over elapsed monotonic time
                </CardDescription>
              </div>
            </CardHeader>
            <ThroughputChart
              data={
                filteredThroughput.length > 0
                  ? filteredThroughput
                  : throughputData
              }
              height={300}
            />
          </Card>

          {/* Physical / Virtual Interfaces Inventory */}
          <Card noPadding>
            <div className="p-5 border-b border-border">
              <CardTitle>Network Adapters Inventory & Packet Counters</CardTitle>
              <CardDescription>
                System network interfaces, hardware link state, link speed, packet counters, and drop counts
              </CardDescription>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-surface-secondary/60 text-xs font-semibold text-text-muted border-b border-border">
                  <tr>
                    <th className="py-3 px-4">Adapter Name</th>
                    <th className="py-3 px-4">Link State</th>
                    <th className="py-3 px-4">Link Speed</th>
                    <th className="py-3 px-4">Bytes Recv</th>
                    <th className="py-3 px-4">Bytes Sent</th>
                    <th className="py-3 px-4">Packets Recv</th>
                    <th className="py-3 px-4">Packets Sent</th>
                    <th className="py-3 px-4 text-right">Errors / Drops</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {interfaces.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-6 text-center text-text-muted text-xs">
                        No physical or virtual network interfaces detected.
                      </td>
                    </tr>
                  ) : (
                    interfaces.map((iface) => (
                      <tr key={iface.name} className="hover:bg-surface-secondary/20 transition-colors">
                        <td className="py-3 px-4 font-mono text-xs font-semibold text-text-primary">
                          {iface.name}
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium border ${
                              iface.is_up
                                ? 'bg-success-bg text-success-text border-success/30'
                                : 'bg-surface-secondary text-text-secondary border-border'
                            }`}
                          >
                            <span
                              className={`h-1.5 w-1.5 rounded-full ${iface.is_up ? 'bg-success' : 'bg-text-muted'}`}
                            />
                            {iface.is_up ? 'UP' : 'DOWN'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-xs text-text-secondary font-mono">
                          {iface.speed_mbps ? `${iface.speed_mbps} Mbps` : 'Auto / Virtual'}
                        </td>
                        <td className="py-3 px-4 text-xs font-mono text-text-secondary">
                          {formatBytes(iface.bytes_recv)}
                        </td>
                        <td className="py-3 px-4 text-xs font-mono text-text-secondary">
                          {formatBytes(iface.bytes_sent)}
                        </td>
                        <td className="py-3 px-4 text-xs font-mono text-text-muted">
                          {iface.packets_recv?.toLocaleString() || '0'}
                        </td>
                        <td className="py-3 px-4 text-xs font-mono text-text-muted">
                          {iface.packets_sent?.toLocaleString() || '0'}
                        </td>
                        <td className="py-3 px-4 text-xs text-right font-mono text-text-muted">
                          {(iface.errin || 0) + (iface.errout || 0)} err / {(iface.dropin || 0) + (iface.dropout || 0)} drop
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* ============================================================ */}
      {/* SCENARIO 6: CONTROLLED THROUGHPUT BENCHMARKING (iperf3)       */}
      {/* ============================================================ */}
      {activeTab === 'controlled' && (
        <div className="space-y-6">
          {/* Informational & Guard Notice */}
          <div className="p-4 rounded-lg bg-surface-secondary/70 border border-border text-xs text-text-secondary flex items-start gap-3">
            <Zap className="w-5 h-5 text-accent shrink-0 mt-0.5" />
            <div className="space-y-1">
              <span className="font-semibold text-text-primary block">
                Controlled Active Throughput Testing Protocol
              </span>
              <p>
                Controlled throughput testing injects active synthetic network streams to benchmark maximum link saturation and retransmission rates.
                This test runs strictly on-demand when explicitly triggered. It requires an authorized destination running an <strong>iperf3 server</strong> (<code className="font-mono bg-white px-1 py-0.5 rounded border border-border">iperf3 -s</code>).
              </p>
            </div>
          </div>

          {/* Test Setup Form */}
          <Card>
            <CardHeader>
              <div>
                <CardTitle>Controlled Test Parameters</CardTitle>
                <CardDescription>
                  Configure destination server, port, and duration for the synthetic bandwidth test
                </CardDescription>
              </div>
            </CardHeader>

            <form onSubmit={handleRunIperf} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Input
                  label="Target Server (IP / Hostname)"
                  placeholder="e.g. 127.0.0.1 or iperf server"
                  value={iperfHost}
                  onChange={(e) => setIperfHost(e.target.value)}
                  disabled={isRunningIperf}
                  helperText="Host running 'iperf3 -s'"
                />

                <Input
                  label="Target Port"
                  type="number"
                  min="1"
                  max="65535"
                  value={iperfPort}
                  onChange={(e) => setIperfPort(Number(e.target.value))}
                  disabled={isRunningIperf}
                  helperText="Default iperf3 port is 5201"
                />

                <Select
                  label="Test Duration"
                  value={iperfDuration}
                  onChange={(e) => setIperfDuration(Number(e.target.value))}
                  disabled={isRunningIperf}
                  options={[
                    { value: 3, label: '3 seconds (Quick)' },
                    { value: 5, label: '5 seconds (Standard)' },
                    { value: 10, label: '10 seconds (Thorough)' },
                  ]}
                />
              </div>

              {/* Safety Authorization Checkbox */}
              <div className="p-3.5 bg-surface-secondary/50 rounded-lg border border-border flex items-start gap-3">
                <input
                  type="checkbox"
                  id="auth-check"
                  checked={isAuthorized}
                  onChange={(e) => setIsAuthorized(e.target.checked)}
                  disabled={isRunningIperf}
                  className="mt-0.5 h-4 w-4 rounded border-border text-accent focus:ring-accent"
                />
                <label htmlFor="auth-check" className="text-xs text-text-secondary cursor-pointer">
                  <strong className="text-text-primary block font-medium">Authorization Confirmation</strong>
                  I confirm that I own or have explicit administrative permission to benchmark network capacity to <span className="font-mono text-text-primary">{iperfHost || 'this host'}:{iperfPort}</span>.
                </label>
              </div>

              <div className="flex justify-end pt-2">
                <Button
                  type="submit"
                  variant="primary"
                  size="md"
                  icon={<Play className="w-4 h-4" />}
                  loading={isRunningIperf}
                  disabled={!isAuthorized || !iperfHost.trim()}
                >
                  {isRunningIperf ? 'Benchmarking Link Throughput...' : 'Execute Controlled Bandwidth Test'}
                </Button>
              </div>
            </form>
          </Card>

          {/* Test Results Card */}
          {iperfResult && (
            <Card>
              <CardHeader>
                <div>
                  <CardTitle>Controlled Test Results</CardTitle>
                  <CardDescription>
                    Benchmark completed at {new Date(iperfResult.timestamp).toLocaleTimeString()}
                  </CardDescription>
                </div>
                {iperfResult.success ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-success-bg text-success-text border border-success/30">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Benchmark Complete
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-warning-bg text-warning-text border border-warning/30">
                    <AlertTriangle className="w-3.5 h-3.5" /> Execution Notice
                  </span>
                )}
              </CardHeader>

              {iperfResult.success ? (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="p-4 rounded-lg bg-surface-secondary/40 border border-border">
                      <span className="text-xs text-text-muted font-medium uppercase">Outbound Throughput (Tx)</span>
                      <p className="text-2xl font-bold text-accent mt-1 tabular-nums">
                        {iperfResult.tx_mbps !== null && iperfResult.tx_mbps !== undefined
                          ? `${formatNumber(iperfResult.tx_mbps, 2)} Mbps`
                          : '—'}
                      </p>
                      <span className="text-[11px] text-text-muted mt-1 block">Sender transfer speed</span>
                    </div>

                    <div className="p-4 rounded-lg bg-surface-secondary/40 border border-border">
                      <span className="text-xs text-text-muted font-medium uppercase">Inbound Throughput (Rx)</span>
                      <p className="text-2xl font-bold text-success mt-1 tabular-nums">
                        {iperfResult.rx_mbps !== null && iperfResult.rx_mbps !== undefined
                          ? `${formatNumber(iperfResult.rx_mbps, 2)} Mbps`
                          : '—'}
                      </p>
                      <span className="text-[11px] text-text-muted mt-1 block">Receiver transfer speed</span>
                    </div>

                    <div className="p-4 rounded-lg bg-surface-secondary/40 border border-border">
                      <span className="text-xs text-text-muted font-medium uppercase">TCP Retransmissions</span>
                      <p className="text-2xl font-bold text-text-primary mt-1 tabular-nums">
                        {iperfResult.retransmits !== null && iperfResult.retransmits !== undefined
                          ? iperfResult.retransmits
                          : 0}
                      </p>
                      <span className="text-[11px] text-text-muted mt-1 block">Dropped packets re-sent</span>
                    </div>
                  </div>

                  <div className="p-3 bg-surface-secondary rounded text-xs text-text-secondary font-mono flex items-center justify-between">
                    <span>Target: {iperfResult.host}:{iperfResult.port}</span>
                    <span>Duration: {iperfResult.duration_seconds} seconds</span>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="p-4 rounded-lg bg-warning-bg/40 border border-warning/30 text-xs text-text-primary space-y-2">
                    <div className="flex items-center gap-2 font-semibold text-warning-text">
                      <AlertTriangle className="w-4 h-4" />
                      <span>{iperfResult.error_type || 'Server or Binary Unavailable'}</span>
                    </div>
                    <p className="text-text-secondary">{iperfResult.error_detail}</p>
                  </div>

                  {/* Clear Setup Instructions */}
                  <div className="p-4 rounded-lg bg-surface-secondary/40 border border-border text-xs space-y-2">
                    <span className="font-semibold text-text-primary block">
                      Requirements & How to Set Up an iperf3 Server
                    </span>
                    <ol className="list-decimal pl-4 space-y-1 text-text-secondary">
                      <li>
                        <strong>Windows:</strong> Install iperf3 using PowerShell:
                        <code className="block my-1 p-2 bg-white rounded border border-border font-mono text-[11px] text-text-primary">
                          winget install iperf3
                        </code>
                        Or download the Windows binary from <code className="font-mono">https://iperf.fr</code>.
                      </li>
                      <li>
                        <strong>Start the Server:</strong> On the destination computer or local machine, open a terminal and run:
                        <code className="block my-1 p-2 bg-white rounded border border-border font-mono text-[11px] text-text-primary">
                          iperf3 -s -p {iperfPort}
                        </code>
                      </li>
                      <li>
                        <strong>Firewall:</strong> Ensure port {iperfPort} is open in Windows Firewall or router on the destination host.
                      </li>
                    </ol>
                  </div>
                </div>
              )}
            </Card>
          )}
        </div>
      )}
    </div>
  );
};
