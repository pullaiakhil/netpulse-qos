import React from 'react';
import { cn } from '@/lib/utils';
import { Inbox } from 'lucide-react';

export interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  action,
  className,
}) => {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center p-8 text-center rounded-lg border border-dashed border-border bg-surface/50 min-h-[220px]',
        className
      )}
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-surface-secondary text-text-muted mb-3">
        {icon || <Inbox className="h-6 w-6" />}
      </div>
      <h4 className="text-sm font-semibold text-text-primary mb-1">{title}</h4>
      {description && (
        <p className="text-xs text-text-secondary max-w-sm mb-4 leading-relaxed">
          {description}
        </p>
      )}
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
};
