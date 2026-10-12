import React from 'react';
import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';

export interface LoadingStateProps {
  message?: string;
  className?: string;
}

export const LoadingState: React.FC<LoadingStateProps> = ({
  message = 'Loading data...',
  className,
}) => {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center p-8 text-center min-h-[160px]',
        className
      )}
    >
      <Loader2 className="h-6 w-6 animate-spin text-accent mb-2" />
      <p className="text-xs text-text-secondary">{message}</p>
    </div>
  );
};
