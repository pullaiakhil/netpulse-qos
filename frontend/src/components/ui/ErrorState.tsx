import React from 'react';
import { cn } from '@/lib/utils';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from './Button';

export interface ErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
  className?: string;
}

export const ErrorState: React.FC<ErrorStateProps> = ({
  title = 'Something went wrong',
  message = 'An unexpected error occurred while communicating with the server.',
  onRetry,
  className,
}) => {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center p-8 text-center rounded-lg border border-critical/20 bg-critical-bg/30 min-h-[200px]',
        className
      )}
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-critical-bg text-critical mb-3">
        <AlertCircle className="h-6 w-6" />
      </div>
      <h4 className="text-sm font-semibold text-critical-text mb-1">{title}</h4>
      <p className="text-xs text-text-secondary max-w-sm mb-4 leading-relaxed">{message}</p>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry} icon={<RefreshCw className="w-3.5 h-3.5" />}>
          Retry Connection
        </Button>
      )}
    </div>
  );
};
