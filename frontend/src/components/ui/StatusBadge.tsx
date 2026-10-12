import React from 'react';
import { cn } from '@/lib/utils';
import { QoSStatus } from '@/lib/types';
import { CheckCircle2, AlertTriangle, AlertCircle, HelpCircle } from 'lucide-react';

export interface StatusBadgeProps {
  status: QoSStatus | 'online' | 'offline' | 'running' | 'completed' | 'stopped';
  className?: string;
  size?: 'sm' | 'md';
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, className, size = 'md' }) => {
  const normalized = status.toLowerCase();

  let label = 'Unknown';
  let colorStyles = 'bg-surface-secondary text-text-secondary border-border';
  let dotColor = 'bg-text-muted';
  let Icon = HelpCircle;

  if (normalized === 'good' || normalized === 'online' || normalized === 'running') {
    label = normalized === 'running' ? 'Active' : normalized === 'online' ? 'Online' : 'Good';
    colorStyles = 'bg-success-bg text-success-text border-success/30';
    dotColor = 'bg-success';
    Icon = CheckCircle2;
  } else if (normalized === 'degraded' || normalized === 'warning') {
    label = 'Degraded';
    colorStyles = 'bg-warning-bg text-warning-text border-warning/30';
    dotColor = 'bg-warning';
    Icon = AlertTriangle;
  } else if (normalized === 'poor' || normalized === 'offline' || normalized === 'critical') {
    label = normalized === 'offline' ? 'Offline' : 'Poor';
    colorStyles = 'bg-critical-bg text-critical-text border-critical/30';
    dotColor = 'bg-critical';
    Icon = AlertCircle;
  } else if (normalized === 'completed' || normalized === 'stopped') {
    label = normalized === 'completed' ? 'Completed' : 'Stopped';
    colorStyles = 'bg-surface-secondary text-text-secondary border-border';
    dotColor = 'bg-text-muted';
    Icon = HelpCircle;
  } else if (normalized === 'insufficient_data') {
    label = 'Insufficient Data';
    colorStyles = 'bg-surface-secondary text-text-secondary border-border';
    dotColor = 'bg-text-muted';
    Icon = HelpCircle;
  }

  const sizeClasses = size === 'sm' ? 'px-2 py-0.5 text-[11px] gap-1' : 'px-2.5 py-1 text-xs gap-1.5';

  return (
    <span
      className={cn(
        'inline-flex items-center font-medium rounded-full border',
        sizeClasses,
        colorStyles,
        className
      )}
    >
      <span className={cn('h-1.5 w-1.5 rounded-full shrink-0', dotColor)} />
      <span>{label}</span>
    </span>
  );
};
