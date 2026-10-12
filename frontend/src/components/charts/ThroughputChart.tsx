import React from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import { ThroughputReading } from '@/lib/types';
import { formatTimestamp, formatKbps } from '@/lib/utils';

export interface ThroughputChartProps {
  data: ThroughputReading[];
  height?: number;
}

export const ThroughputChart: React.FC<ThroughputChartProps> = ({
  data,
  height = 260,
}) => {
  const chartData = data.map((d) => ({
    time: formatTimestamp(d.timestamp),
    rx: Number((d.rx_kbps || 0).toFixed(1)),
    tx: Number((d.tx_kbps || 0).toFixed(1)),
  }));

  if (chartData.length === 0) {
    return (
      <div
        className="flex items-center justify-center text-xs text-text-muted bg-surface-secondary/40 rounded-md border border-border"
        style={{ height }}
      >
        No throughput telemetry available
      </div>
    );
  }

  return (
    <div style={{ width: '100%', height }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
          <defs>
            <linearGradient id="rxGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#16A34A" stopOpacity={0.15} />
              <stop offset="95%" stopColor="#16A34A" stopOpacity={0.0} />
            </linearGradient>
            <linearGradient id="txGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#4263EB" stopOpacity={0.15} />
              <stop offset="95%" stopColor="#4263EB" stopOpacity={0.0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="#E4E7EC" strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="time"
            tick={{ fill: '#667085', fontSize: 11 }}
            axisLine={{ stroke: '#E4E7EC' }}
            tickLine={false}
            dy={8}
          />
          <YAxis
            tick={{ fill: '#667085', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            dx={-4}
            tickFormatter={(val) => `${val} Kb/s`}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#FFFFFF',
              borderColor: '#E4E7EC',
              borderRadius: '6px',
              fontSize: '12px',
              boxShadow: '0 4px 6px -1px rgba(16, 24, 40, 0.1)',
            }}
            formatter={(value: any, name: string) => [
              formatKbps(Number(value)),
              name === 'rx' ? 'Inbound (Rx)' : 'Outbound (Tx)',
            ]}
            labelFormatter={(label) => `Time: ${label}`}
          />
          <Legend
            verticalAlign="top"
            height={32}
            formatter={(val) => (val === 'rx' ? 'Rx (Download)' : 'Tx (Upload)')}
          />
          <Area
            type="monotone"
            dataKey="rx"
            name="rx"
            stroke="#16A34A"
            strokeWidth={2}
            fill="url(#rxGradient)"
            isAnimationActive={false}
          />
          <Area
            type="monotone"
            dataKey="tx"
            name="tx"
            stroke="#4263EB"
            strokeWidth={2}
            fill="url(#txGradient)"
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};
