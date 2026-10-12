import React from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import { ProbeResult } from '@/lib/types';
import { formatTimestamp } from '@/lib/utils';

export interface PacketLossChartProps {
  data: ProbeResult[];
  height?: number;
}

export const PacketLossChart: React.FC<PacketLossChartProps> = ({
  data,
  height = 220,
}) => {
  const chartData = data.map((d) => ({
    time: formatTimestamp(d.timestamp),
    loss: d.packet_loss_pct !== null && d.packet_loss_pct !== undefined ? Number(d.packet_loss_pct.toFixed(1)) : 0,
  }));

  if (chartData.length === 0) {
    return (
      <div
        className="flex items-center justify-center text-xs text-text-muted bg-surface-secondary/40 rounded-md border border-border"
        style={{ height }}
      >
        No packet loss recorded
      </div>
    );
  }

  return (
    <div style={{ width: '100%', height }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="lossGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#DC2626" stopOpacity={0.15} />
              <stop offset="95%" stopColor="#DC2626" stopOpacity={0.0} />
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
            unit="%"
            domain={[0, 100]}
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
            formatter={(value: any) => [`${value}%`, 'Packet Loss']}
            labelFormatter={(label) => `Time: ${label}`}
          />
          <Area
            type="stepAfter"
            dataKey="loss"
            stroke="#DC2626"
            strokeWidth={1.5}
            fill="url(#lossGradient)"
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};
