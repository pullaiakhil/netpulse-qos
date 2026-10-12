import React from 'react';
import { cn } from '@/lib/utils';
import { QoSStatus } from '@/lib/types';
import { StatusBadge } from './StatusBadge';

export interface MetricCardProps {
  title: string;
  value: string | number | null;
  unit?: string;
  subtitle?: string;
  status?: QoSStatus;
  icon?: React.ReactNode;
  loading?: boolean;
  className?: string;
}

export const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  unit,
  subtitle,
  status,
  icon,
  loading = false,
  className,
}) => {
  return (
    <div
      className={cn(
        'bg-surface border border-border rounded-lg p-5 shadow-sm flex flex-col justify-between transition-all hover:border-text-muted/30',
        className
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-text-secondary uppercase tracking-wider">
          {title}
        </span>
        {icon && <span className="text-text-muted p-1 bg-surface-secondary rounded-md">{icon}</span>}
      </div>

      <div className="my-3">
        {loading ? (
          <div className="h-8 w-28 bg-surface-secondary animate-pulse rounded my-1" />
        ) : (
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-semibold tabular-nums text-text-primary tracking-tight">
              {value !== null && value !== undefined ? value : '—'}
            </span>
            {unit && <span className="text-xs font-medium text-text-muted">{unit}</span>}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between text-xs pt-2 border-t border-border/50">
        <span className="text-text-muted truncate max-w-[140px]">{subtitle || 'Live metric'}</span>
        {status && <StatusBadge status={status} size="sm" />}
      </div>
    </div>
  );
};
