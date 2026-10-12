import React from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import { ProbeResult } from '@/lib/types';
import { formatTimestamp } from '@/lib/utils';

export interface LatencyChartProps {
  data: ProbeResult[];
  height?: number;
  showDots?: boolean;
}

export const LatencyChart: React.FC<LatencyChartProps> = ({
  data,
  height = 260,
  showDots = false,
}) => {
  const chartData = data.map((d) => ({
    time: formatTimestamp(d.timestamp),
    rtt: d.rtt_ms !== null && d.rtt_ms !== undefined ? Number(d.rtt_ms.toFixed(1)) : null,
    loss: d.packet_loss_pct || 0,
  }));

  if (chartData.length === 0) {
    return (
      <div
        className="flex items-center justify-center text-xs text-text-muted bg-surface-secondary/40 rounded-md border border-border"
        style={{ height }}
      >
        No latency data recorded yet
      </div>
    );
  }

  return (
    <div style={{ width: '100%', height }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
          <CartesianGrid stroke="#E4E7EC" strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="time"
            tick={{ fill: '#667085', fontSize: 11 }}
            axisLine={{ stroke: '#E4E7EC' }}
            tickLine={false}
            dy={8}
          />
          <YAxis
            unit=" ms"
            tick={{ fill: '#667085', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            dx={-4}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#FFFFFF',
              borderColor: '#E4E7EC',
              borderRadius: '6px',
              fontSize: '12px',
              boxShadow: '0 4px 6px -1px rgba(16, 24, 40, 0.1)',
            }}
            formatter={(value: any) => [`${value} ms`, 'Round Trip Time']}
            labelFormatter={(label) => `Time: ${label}`}
          />
          <Line
            type="monotone"
            dataKey="rtt"
            name="RTT"
            stroke="#4263EB"
            strokeWidth={2}
            dot={showDots ? { r: 3, fill: '#4263EB' } : false}
            activeDot={{ r: 5, fill: '#4263EB', stroke: '#FFFFFF', strokeWidth: 2 }}
            isAnimationActive={false}
            connectNulls
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};
